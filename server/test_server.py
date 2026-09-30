#!/usr/bin/env python3
"""
Server test suite (stdlib unittest): API behaviour + level-code codec.

Runs a real HTTP server on an ephemeral port against a throwaway database.
Usage:  python3 server/test_server.py          (or -v for verbose)
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import ndl  # noqa: E402
from app import build_server  # noqa: E402


# ------------------------------------------------------------------ helpers

def http(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {}


def make_level(name="Test Level", author="Tester", difficulty=1, length=60,
               objects=None):
    return {
        "name": name, "author": author, "songId": 1, "themeId": 0,
        "difficulty": difficulty, "length": length,
        "objects": objects if objects is not None else [{"t": 20, "x": 10, "y": 0}],
    }


# ------------------------------------------------------------------ codec

class TestCodec(unittest.TestCase):

    def test_official_levels_decode(self):
        src = os.path.join(HERE, "..", "game", "js", "levels", "official.js")
        with open(src, "r", encoding="utf-8") as f:
            text = f.read()
        import re
        codes = re.findall(r'"code":\s*"(NDL1:[^"]+)"', text)
        self.assertEqual(len(codes), 4)
        counts = []
        for code in codes:
            lv = ndl.decode(code)
            self.assertTrue(lv["name"])
            counts.append(len(lv["objects"]))
        self.assertEqual(counts, [71, 78, 98, 81])

    def test_roundtrip(self):
        lv = make_level(objects=[{"t": 20, "x": 3, "y": 0},
                                 {"t": 1, "x": 9, "y": 2, "r": 2},
                                 {"t": 33, "x": 12, "y": 0, "r": 0, "p": 12345}])
        code = ndl.encode(lv)
        self.assertTrue(code.startswith("NDL1:"))
        back = ndl.decode(code)
        self.assertEqual(back["name"], lv["name"])
        self.assertEqual(len(back["objects"]), 3)
        self.assertEqual(back["objects"][2]["p"], 12345)
        self.assertEqual(back["objects"][1]["r"], 2)

    def test_rejects_corruption(self):
        lv = make_level()
        code = ndl.encode(lv)
        with self.assertRaises(ndl.LevelError):
            ndl.decode("")                       # empty
        with self.assertRaises(ndl.LevelError):
            ndl.decode("hello world")            # not a code
        with self.assertRaises(ndl.LevelError):
            ndl.decode("XXX1:aaaa:00000000")     # wrong magic
        with self.assertRaises(ndl.LevelError):
            ndl.decode("NDL1:aaaa:00000000")     # bad base64
        with self.assertRaises(ndl.LevelError):
            ndl.decode(code[:-1] + ("b" if code[-1] != "b" else "c"))  # crc mismatch

    def test_rejects_hostile_payloads(self):
        # valid checksum, hostile content
        import base64
        import zlib
        for payload in (
            "1;;a;0;0;1;50",                      # empty name
            "1;x;a;99;0;1;50",                    # bad song id
            "1;x;a;0;0;9;50",                     # bad difficulty
            "1;x;a;0;0;1;5",                      # too short
            "1;x;a;0;0;1;50;zz.1.0",              # unknown object type
            "1;x;a;0;0;1;50;1.1.1.9",             # bad rotation
            "1;x;a;0;0;1;50;1.1.1.0.99999",       # bad param
            "1;x;a;0;0;1;50;1.999999.0",          # beyond level end
            "1;x;a;0;0;1;50;1.5.13",              # pokes above ceiling
        ):
            b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
            crc = "%08x" % (zlib.crc32(payload.encode()) & 0xFFFFFFFF)
            with self.assertRaises(ndl.LevelError, msg=payload):
                ndl.decode("NDL1:%s:%s" % (b64, crc))

    def test_sanitize_name(self):
        self.assertEqual(ndl.sanitize_name("a;b#c\nd"), "a b c d")
        self.assertEqual(ndl.sanitize_name("  x  "), "x")
        self.assertEqual(len(ndl.sanitize_name("x" * 500)), 24)


# ------------------------------------------------------------------ API

class TestApi(unittest.TestCase):
    tmpdir = None
    httpd = None
    port = None
    base = None

    @classmethod
    def setUpClass(cls):
        cls.tmpdir = tempfile.mkdtemp(prefix="nd-test-")
        db = os.path.join(cls.tmpdir, "test.db")
        cls.httpd = build_server(0, db)
        cls.port = cls.httpd.server_address[1]
        cls.base = "http://127.0.0.1:%d" % cls.port
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def upload(self, **kw):
        lv = make_level(**kw)
        code = ndl.encode(lv)
        return http("POST", self.base + "/api/levels",
                    {"name": lv["name"], "author": lv["author"], "code": code})

    # ---- basics

    def test_health(self):
        status, data = http("GET", self.base + "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(data["version"], "1.0.0")

    def test_upload_and_fetch(self):
        status, data = self.upload(name="Fetch Me")
        self.assertEqual(status, 201)
        lid = data["id"]

        status, meta = http("GET", self.base + "/api/levels/%d" % lid)
        self.assertEqual(status, 200)
        self.assertEqual(meta["name"], "Fetch Me")
        self.assertEqual(meta["stats"]["views"], 1)

        status, dl = http("GET", self.base + "/api/levels/%d/download" % lid)
        self.assertEqual(status, 200)
        self.assertTrue(dl["code"].startswith("NDL1:"))
        status, meta2 = http("GET", self.base + "/api/levels/%d" % lid)
        self.assertEqual(meta2["stats"]["downloads"], 1)

    def test_upload_duplicate_code_returns_same_id(self):
        s1, d1 = self.upload(name="Dup", author="SameGuy")
        s2, d2 = self.upload(name="Dup", author="SameGuy")
        self.assertEqual(s1, 201)
        self.assertEqual(d2["id"], d1["id"])
        self.assertTrue(d2.get("duplicate"))

    def test_upload_rejects_bad_code(self):
        status, data = http("POST", self.base + "/api/levels",
                            {"name": "Bad", "author": "X", "code": "NDL1:zzz:00000000"})
        self.assertEqual(status, 400)
        self.assertIn("error", data)

    def test_upload_rejects_missing_fields(self):
        status, data = http("POST", self.base + "/api/levels", {"author": "X"})
        self.assertEqual(status, 400)
        status, data = http("POST", self.base + "/api/levels",
                            {"name": "N", "author": "X", "code": 123})
        self.assertEqual(status, 400)

    def test_list_sort_and_search(self):
        for i in range(3):
            self.upload(name="Sortable %d" % i, author="Sorter")
        status, data = http("GET", self.base + "/api/levels?sort=new&limit=50")
        self.assertEqual(status, 200)
        names = [l["name"] for l in data["levels"]]
        self.assertIn("Sortable 2", names)
        self.assertGreaterEqual(data["total"], 3)

        status, data = http("GET", self.base + "/api/levels?q=Sortable")
        self.assertEqual(status, 200)
        self.assertTrue(all("Sortable" in n for n in
                            [l["name"] for l in data["levels"]]))

        status, _ = http("GET", self.base + "/api/levels?sort=bogus")
        self.assertEqual(status, 400)

    def test_pagination(self):
        status, data = http("GET", self.base + "/api/levels?limit=2&page=1")
        self.assertEqual(status, 200)
        self.assertEqual(len(data["levels"]), 2)
        status, data2 = http("GET", self.base + "/api/levels?limit=2&page=2")
        self.assertNotEqual([l["id"] for l in data["levels"]],
                            [l["id"] for l in data2["levels"]])

    def test_likes(self):
        s, d = self.upload(name="Likeable")
        lid = d["id"]
        s, r = http("POST", self.base + "/api/levels/%d/like" % lid, {"value": 1})
        self.assertEqual(s, 200)
        self.assertEqual(r["likes"], 1)
        s, r = http("POST", self.base + "/api/levels/%d/like" % lid, {"value": 1})
        self.assertEqual(r["likes"], 2)
        s, r = http("POST", self.base + "/api/levels/%d/like" % lid, {"value": -1})
        self.assertEqual(r["likes"], 1)
        s, r = http("POST", self.base + "/api/levels/%d/like" % lid, {"value": 0})
        self.assertEqual(s, 400)
        s, r = http("POST", self.base + "/api/levels/999999/like", {"value": 1})
        self.assertEqual(s, 404)

    def test_events(self):
        s, d = self.upload(name="Eventful")
        lid = d["id"]
        s, r = http("POST", self.base + "/api/levels/%d/events" % lid, {"type": "attempt"})
        self.assertEqual(s, 200)
        self.assertEqual(r["plays"], 1)
        self.assertEqual(r["completions"], 0)
        s, r = http("POST", self.base + "/api/levels/%d/events" % lid, {"type": "complete"})
        self.assertEqual(r["completions"], 1)
        s, r = http("POST", self.base + "/api/levels/%d/events" % lid, {"type": "bogus"})
        self.assertEqual(s, 400)

    def test_stats(self):
        self.upload(name="Stat Me")
        status, data = http("GET", self.base + "/api/stats")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertGreaterEqual(data["totals"]["levels"], 1)
        self.assertIn("top", data)
        self.assertIn("recent", data)

    def test_404s(self):
        status, data = http("GET", self.base + "/api/levels/999999")
        self.assertEqual(status, 404)
        status, data = http("GET", self.base + "/api/nope")
        self.assertEqual(status, 404)
        status, data = http("POST", self.base + "/api/levels/1/nope", {})
        self.assertEqual(status, 404)

    def test_static_site_and_play(self):
        # web/ and game/ may be empty dirs in some checkouts — the routes must
        # respond with 200 for whatever files exist, 404 otherwise.
        for path in ("/", "/index.html", "/play/"):
            try:
                status = urllib.request.urlopen(self.base + path, timeout=5).status
            except urllib.error.HTTPError as e:
                status = e.code
            self.assertIn(status, (200, 404))

    def test_no_traversal(self):
        for path in ("/../etc/passwd", "/play/../server/app.py",
                     "/..%2f..%2fetc%2fpasswd"):
            try:
                status = urllib.request.urlopen(self.base + path, timeout=5).status
            except urllib.error.HTTPError as e:
                status = e.code
            self.assertNotEqual(status, 200, path)


if __name__ == "__main__":
    unittest.main(verbosity=2)

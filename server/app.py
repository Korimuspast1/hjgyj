#!/usr/bin/env python3
"""
Neon Dash — companion API server + static hosting.

Standard library only (http.server + sqlite3), mirrors the REST API the game
client expects (game/js/ui/net.js):

    GET  /api/health                     liveness probe
    GET  /api/levels?q=&sort=&page=&limit=   browse / search
    POST /api/levels                     upload {name, author, code}
    GET  /api/levels/<id>                metadata (increments views)
    GET  /api/levels/<id>/download       full code (increments downloads)
    POST /api/levels/<id>/like           {value: 1|-1}
    POST /api/levels/<id>/events         {type: "attempt"|"complete"}
    GET  /api/stats                      global stats for the website

Static hosting:
    /            -> web/   (stats & leaderboard website)
    /play/...    -> game/  (the playable web build)

Usage:
    python3 server/app.py [--port 8080] [--db server/neon.db]
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

sys.path.insert(0, HERE)
import ndl  # noqa: E402  (level-code codec & validator)

APP_VERSION = "1.0.0"
MAX_BODY = 256 * 1024          # 256 KB is plenty for any level code
MAX_LIMIT = 100
ID_RE = re.compile(r"^\d+$")

# ---------------------------------------------------------------- database

SCHEMA = """
CREATE TABLE IF NOT EXISTS levels (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  author       TEXT NOT NULL DEFAULT 'Player',
  code         TEXT NOT NULL,
  difficulty   INTEGER NOT NULL DEFAULT 1,
  length       INTEGER NOT NULL DEFAULT 100,
  objects      INTEGER NOT NULL DEFAULT 0,
  official     INTEGER NOT NULL DEFAULT 0,
  views        INTEGER NOT NULL DEFAULT 0,
  downloads    INTEGER NOT NULL DEFAULT 0,
  likes        INTEGER NOT NULL DEFAULT 0,
  plays        INTEGER NOT NULL DEFAULT 0,
  completions  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_levels_created ON levels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_levels_likes ON levels(likes DESC);
CREATE INDEX IF NOT EXISTS idx_levels_downloads ON levels(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_levels_plays ON levels(plays DESC);
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id   INTEGER NOT NULL,
  type       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_level ON events(level_id);
"""


class Database(object):
    """Tiny thread-safe wrapper over sqlite3."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        with self.lock, self.conn:
            self.conn.executescript(SCHEMA)

    def execute(self, sql, params=()):
        with self.lock, self.conn:
            return self.conn.execute(sql, params)

    def query(self, sql, params=()):
        with self.lock:
            return self.conn.execute(sql, params).fetchall()

    def query_one(self, sql, params=()):
        rows = self.query(sql, params)
        return rows[0] if rows else None


# ---------------------------------------------------------------- helpers

def row_to_meta(row, with_stats=True):
    out = {
        "id": row["id"],
        "name": row["name"],
        "author": row["author"],
        "difficulty": row["difficulty"],
        "length": row["length"],
        "objects": row["objects"],
        "official": bool(row["official"]),
        "createdAt": row["created_at"],
    }
    if with_stats:
        out["stats"] = {
            "views": row["views"],
            "downloads": row["downloads"],
            "likes": row["likes"],
            "plays": row["plays"],
            "completions": row["completions"],
        }
    return out


SORTS = {
    "new": "created_at DESC, id DESC",
    "likes": "likes DESC, id DESC",
    "downloads": "downloads DESC, id DESC",
    "plays": "plays DESC, id DESC",
}


class ApiError(Exception):
    def __init__(self, status, message):
        super(ApiError, self).__init__(message)
        self.status = status
        self.message = message


# ---------------------------------------------------------------- handler

class Handler(BaseHTTPRequestHandler):
    server_version = "NeonDash/" + APP_VERSION
    protocol_version = "HTTP/1.1"

    # injected by serve():
    db = None
    web_root = os.path.join(ROOT, "web")
    game_root = os.path.join(ROOT, "game")
    started_at = time.time()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # ---- plumbing

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            raise ApiError(400, "Missing request body")
        if length > MAX_BODY:
            raise ApiError(413, "Request body too large")
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            raise ApiError(400, "Invalid JSON body")
        if not isinstance(data, dict):
            raise ApiError(400, "JSON body must be an object")
        return data

    def _static(self, root, rel_path, default="index.html"):
        """Serve a file from root safely (no traversal)."""
        rel_path = unquote(rel_path).lstrip("/")
        if not rel_path or rel_path.endswith("/"):
            rel_path = (rel_path + default) if rel_path else default
        full = os.path.realpath(os.path.join(root, rel_path))
        root_real = os.path.realpath(root)
        if not full.startswith(root_real + os.sep) and full != root_real:
            raise ApiError(404, "Not found")
        if not os.path.isfile(full):
            raise ApiError(404, "Not found")
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
            ".mp3": "audio/mpeg",
            ".ogg": "audio/ogg",
            ".wav": "audio/wav",
        }.get(os.path.splitext(full)[1].lower(), "application/octet-stream")
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # ---- HTTP verbs

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        try:
            self._route_get()
        except ApiError as e:
            self._send_json({"error": e.message}, e.status)
        except BrokenPipeError:
            pass
        except Exception as e:  # pragma: no cover - defensive
            self._send_json({"error": "Internal server error: %s" % e}, 500)

    def do_POST(self):
        try:
            self._route_post()
        except ApiError as e:
            self._send_json({"error": e.message}, e.status)
        except BrokenPipeError:
            pass
        except Exception as e:  # pragma: no cover - defensive
            self._send_json({"error": "Internal server error: %s" % e}, 500)

    # ---- routing

    def _route_get(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/health":
            self._send_json({
                "ok": True, "version": APP_VERSION,
                "uptime": round(time.time() - self.started_at, 1),
                "levels": self.db.query_one("SELECT COUNT(*) AS n FROM levels")["n"],
            })
            return

        m = re.match(r"^/api/levels$", path)
        if m:
            self._api_list(parse_qs(parsed.query))
            return

        m = re.match(r"^/api/levels/(\d+)$", path)
        if m:
            self._api_get_level(int(m.group(1)))
            return

        m = re.match(r"^/api/levels/(\d+)/download$", path)
        if m:
            self._api_download(int(m.group(1)))
            return

        if path == "/api/stats":
            self._api_stats()
            return

        if path.startswith("/api/"):
            raise ApiError(404, "Unknown API endpoint: %s" % path)

        # /play and /play/... serve the game build; everything else the site.
        if path == "/play" or path.startswith("/play/"):
            self._static(self.game_root, path[len("/play/"):])
        else:
            self._static(self.web_root, path)

    def _route_post(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/levels":
            self._api_upload()
            return

        m = re.match(r"^/api/levels/(\d+)/like$", path)
        if m:
            self._api_like(int(m.group(1)))
            return

        m = re.match(r"^/api/levels/(\d+)/events$", path)
        if m:
            self._api_event(int(m.group(1)))
            return

        raise ApiError(404, "Unknown API endpoint: %s" % path)

    # ---- endpoints

    def _api_list(self, qs):
        q = (qs.get("q") or [""])[0].strip()
        sort = (qs.get("sort") or ["new"])[0]
        page = max(1, int((qs.get("page") or ["1"])[0] or 1))
        limit = min(MAX_LIMIT, max(1, int((qs.get("limit") or ["30"])[0] or 30)))
        if sort not in SORTS:
            raise ApiError(400, "Unknown sort '%s' (new|likes|downloads|plays)" % sort)
        where, params = "", []
        if q:
            where = "WHERE name LIKE ? OR author LIKE ?"
            like = "%" + q.replace("%", "").replace("_", "") + "%"
            params = [like, like]
        offset = (page - 1) * limit
        rows = self.db.query(
            "SELECT * FROM levels %s ORDER BY %s LIMIT ? OFFSET ?" % (where, SORTS[sort]),
            params + [limit, offset])
        total = self.db.query_one("SELECT COUNT(*) AS n FROM levels %s" % where, params)["n"]
        self._send_json({
            "levels": [row_to_meta(r) for r in rows],
            "page": page, "limit": limit, "total": total,
        })

    def _get_row(self, level_id):
        row = self.db.query_one("SELECT * FROM levels WHERE id = ?", (level_id,))
        if not row:
            raise ApiError(404, "Level not found")
        return row

    def _api_get_level(self, level_id):
        self.db.execute("UPDATE levels SET views = views + 1 WHERE id = ?", (level_id,))
        row = self._get_row(level_id)
        self._send_json(row_to_meta(row))

    def _api_download(self, level_id):
        self.db.execute("UPDATE levels SET downloads = downloads + 1 WHERE id = ?", (level_id,))
        row = self._get_row(level_id)
        self._send_json({"id": row["id"], "name": row["name"], "code": row["code"]})

    def _api_upload(self):
        data = self._read_json()
        name = ndl.sanitize_name(data.get("name"))
        author = ndl.sanitize_name(data.get("author")) or "Player"
        code = data.get("code")
        if not name:
            raise ApiError(400, "Level name missing")
        if not isinstance(code, str):
            raise ApiError(400, "Level code missing")
        try:
            level = ndl.decode(code)
        except ndl.LevelError as e:
            raise ApiError(400, "Invalid level code: %s" % e)

        # Duplicate protection: identical code by the same author -> same id.
        existing = self.db.query_one(
            "SELECT id FROM levels WHERE code = ? AND author = ?", (code, author))
        if existing:
            self._send_json({"id": existing["id"], "duplicate": True})
            return

        now = int(time.time())
        cur = self.db.execute(
            "INSERT INTO levels (name, author, code, difficulty, length, objects,"
            " created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
            (name, author, code, level["difficulty"], level["length"],
             len(level["objects"]), now, now))
        self._send_json({"id": cur.lastrowid}, 201)

    def _api_like(self, level_id):
        data = self._read_json()
        value = data.get("value", 1)
        if value not in (1, -1):
            raise ApiError(400, "Like value must be 1 or -1")
        self._get_row(level_id)
        self.db.execute(
            "UPDATE levels SET likes = MAX(0, likes + ?) WHERE id = ?", (value, level_id))
        row = self._get_row(level_id)
        self._send_json({"id": row["id"], "likes": row["likes"]})

    def _api_event(self, level_id):
        data = self._read_json()
        etype = data.get("type")
        if etype not in ("attempt", "complete"):
            raise ApiError(400, "Event type must be 'attempt' or 'complete'")
        self._get_row(level_id)
        if etype == "attempt":
            self.db.execute("UPDATE levels SET plays = plays + 1 WHERE id = ?", (level_id,))
        else:
            self.db.execute(
                "UPDATE levels SET plays = plays + 1, completions = completions + 1"
                " WHERE id = ?", (level_id,))
        self.db.execute(
            "INSERT INTO events (level_id, type, created_at) VALUES (?,?,?)",
            (level_id, etype, int(time.time())))
        row = self._get_row(level_id)
        self._send_json({"ok": True, "plays": row["plays"], "completions": row["completions"]})

    def _api_stats(self):
        totals = self.db.query_one(
            "SELECT COUNT(*) AS levels,"
            " COALESCE(SUM(views),0) AS views,"
            " COALESCE(SUM(downloads),0) AS downloads,"
            " COALESCE(SUM(likes),0) AS likes,"
            " COALESCE(SUM(plays),0) AS plays,"
            " COALESCE(SUM(completions),0) AS completions FROM levels")
        top = self.db.query(
            "SELECT * FROM levels ORDER BY likes DESC, downloads DESC, id DESC LIMIT 10")
        recent = self.db.query(
            "SELECT * FROM levels WHERE official = 0 ORDER BY created_at DESC, id DESC LIMIT 10")
        self._send_json({
            "ok": True,
            "version": APP_VERSION,
            "uptime": round(time.time() - self.started_at, 1),
            "totals": dict(totals),
            "top": [row_to_meta(r) for r in top],
            "recent": [row_to_meta(r) for r in recent],
        })


# ---------------------------------------------------------------- entry

def build_server(port, db_path):
    db = Database(db_path)
    Handler.db = db
    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    httpd.daemon_threads = True
    return httpd


def main():
    ap = argparse.ArgumentParser(description="Neon Dash API server")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)))
    ap.add_argument("--db", default=os.environ.get("ND_DB", os.path.join(HERE, "neon.db")))
    args = ap.parse_args()
    httpd = build_server(args.port, args.db)
    print("Neon Dash API %s listening on http://0.0.0.0:%d" % (APP_VERSION, args.port))
    print("  website:  http://localhost:%d/" % args.port)
    print("  web play: http://localhost:%d/play/" % args.port)
    print("  database: %s" % args.db)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")


if __name__ == "__main__":
    main()

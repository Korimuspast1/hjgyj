#!/usr/bin/env python3
"""
Seed the Neon Dash database with the official levels (extracted straight from
game/js/levels/official.js so they can never drift) plus a couple of demo
community levels for the leaderboard.

Usage:  python3 server/seed.py [--db server/neon.db]
"""
import argparse
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ndl  # noqa: E402

from app import Database, APP_VERSION  # noqa: E402


def official_codes():
    src = os.path.join(HERE, "..", "game", "js", "levels", "official.js")
    with open(src, "r", encoding="utf-8") as f:
        text = f.read()
    out = []
    for m in re.finditer(
            r'"id":\s*"(l\d)",\s*"name":\s*"([^"]+)",\s*"author":\s*"([^"]+)",'
            r'\s*"difficulty":\s*(\d),\s*"stars":\s*(\d),\s*"code":\s*"(NDL1:[^"]+)"',
            text):
        out.append({
            "key": m.group(1), "name": m.group(2), "author": m.group(3),
            "difficulty": int(m.group(4)), "stars": int(m.group(5)),
            "code": m.group(6),
        })
    return out


def demo_levels():
    """Small hand-made community levels for a lively leaderboard."""
    def spike_run(name, author, difficulty, length, spikes, extras=None):
        objects = [{"t": 20, "x": x, "y": 0} for x in spikes]
        objects += (extras or [])
        return {"name": name, "author": author, "difficulty": difficulty,
                "length": length, "objects": objects,
                "songId": 1, "themeId": 2}

    demos = [
        spike_run("First Steps", "RoboDash", 0, 40,
                  [12, 20, 21, 30], [{"t": 1, "x": 34, "y": 0}]),
        spike_run("Saw Dance", "ByteBandit", 2, 60,
                  [14, 22, 36, 44, 52],
                  [{"t": 28, "x": 28, "y": 0}, {"t": 50, "x": 40, "y": 0}]),
        spike_run("Gravity Lab", "ProfNeon", 3, 80,
                  [16, 24, 55, 63, 71],
                  [{"t": 40, "x": 30, "y": 0}, {"t": 41, "x": 48, "y": 11},
                   {"t": 13, "x": 44, "y": 8}]),
    ]
    for d in demos:
        d["code"] = ndl.encode(d)
    return demos


def seed(db_path):
    db = Database(db_path)
    now = int(time.time())

    officials = official_codes()
    if not officials:
        print("ERROR: could not extract official levels from official.js")
        return 1

    n = 0
    for i, entry in enumerate(officials):
        level = ndl.decode(entry["code"])
        existing = db.query_one("SELECT id FROM levels WHERE name=? AND author=?",
                                (entry["name"], entry["author"]))
        if existing:
            continue
        db.execute(
            "INSERT INTO levels (name, author, code, difficulty, length, objects,"
            " official, created_at, updated_at) VALUES (?,?,?,?,?,?,1,?,?)",
            (entry["name"], entry["author"], entry["code"], level["difficulty"],
             level["length"], len(level["objects"]), now - 86400 * (10 - i), now))
        n += 1

    for j, demo in enumerate(demo_levels()):
        existing = db.query_one("SELECT id FROM levels WHERE name=? AND author=?",
                                (demo["name"], demo["author"]))
        if existing:
            continue
        db.execute(
            "INSERT INTO levels (name, author, code, difficulty, length, objects,"
            " views, downloads, likes, plays, completions, created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (demo["name"], demo["author"], demo["code"], demo["difficulty"],
             demo["length"], len(demo["objects"]),
             120 + j * 40, 30 + j * 12, 12 + j * 5, 40 + j * 9, 3 + j, now - 3600 * (j + 1), now))
        n += 1

    total = db.query_one("SELECT COUNT(*) AS n FROM levels")["n"]
    print("seeded %d new level(s); database now has %d" % (n, total))
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.join(HERE, "neon.db"))
    args = ap.parse_args()
    sys.exit(seed(args.db))

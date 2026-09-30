"""
Neon Dash — level-code codec & validator (Python mirror of game/js/core/encoding.js
and the validation rules in game/js/core/level.js).

The shareable "level code" format, version 1:

    NDL1:<base64url(payload)>:<crc32-hex-of-payload>

    payload  = "1;name;author;song;theme;difficulty;length;object;object;..."
    object   = "t.x.y" | "t.x.y.r" | "t.x.y.r.p"     (all base-36 integers)

This module never imports anything outside the standard library, so the API
server runs anywhere Python 3.8+ is installed.
"""
import json
import os
import re
import zlib
import base64

HERE = os.path.dirname(os.path.abspath(__file__))

MAGIC = "NDL1"
PAYLOAD_VERSION = 1

MAX_NAME = 24
MIN_LENGTH = 16
MAX_LENGTH = 6000
MAX_OBJECTS = 20000
MIN_SONGS = 1          # the game ships 4 songs; the server accepts any id in 0..99
MAX_SONGS = 100
MAX_THEMES = 100
MAX_DIFFICULTIES = 5   # easy..insane
MAX_X = 100000
MAX_Y = 13
LEVEL_HEIGHT = 14
LENGTH_OVERFLOW = 32   # objects may poke up to 32 units past the finish line


class LevelError(ValueError):
    """Raised for any invalid level code — message is user-facing."""


def _load_defs():
    with open(os.path.join(HERE, "objectdefs.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    defs = {d["id"]: d for d in data["defs"]}
    return data, defs

_DEFS_DATA, _DEFS = _load_defs()
LEVEL_HEIGHT = _DEFS_DATA.get("LEVEL_HEIGHT", LEVEL_HEIGHT)
MAX_X = _DEFS_DATA.get("MAX_X", MAX_X)
MAX_Y = _DEFS_DATA.get("MAX_Y", MAX_Y)


def sanitize_name(s, max_len=MAX_NAME):
    """Mirror of util.sanitizeName: strip level-code separators, trim, cap."""
    s = re.sub(r"[;|#\r\n\t]", " ", str(s or ""))
    return s.strip()[:max_len]


def _from36(token, what):
    if not re.fullmatch(r"[0-9a-zA-Z]+", token or ""):
        raise LevelError("Invalid base-36 token %r in %s" % (token, what))
    try:
        return int(token, 36)
    except ValueError:
        raise LevelError("Invalid base-36 value %r in %s" % (token, what))


def decode(code):
    """Full level code -> dict {name, author, songId, themeId, difficulty,
    length, objects:[{t,x,y,r?,p?}]}.  Raises LevelError on anything invalid."""
    if not isinstance(code, str):
        raise LevelError("Level code must be a string")
    code = code.strip()
    if not code:
        raise LevelError("Empty level code")
    segments = code.split(":")
    if len(segments) != 3:
        raise LevelError("Not a Neon Dash level code (expected NDL1:...:...)")
    if segments[0] != MAGIC:
        raise LevelError('Unknown level code header "%s"' % segments[0])
    checksum = segments[2].lower()
    if not re.fullmatch(r"[0-9a-f]{8}", checksum):
        raise LevelError("Corrupted checksum in level code")
    try:
        pad = "=" * (-len(segments[1]) % 4)
        payload = base64.urlsafe_b64decode(segments[1] + pad).decode("utf-8")
    except Exception:
        raise LevelError("Corrupted level data (invalid base64)")
    if ("%08x" % (zlib.crc32(payload.encode("utf-8")) & 0xFFFFFFFF)) != checksum:
        raise LevelError("Level code checksum mismatch — the code is corrupted")
    return decode_payload(payload)


def decode_payload(payload):
    parts = payload.split(";")
    if len(parts) < 7:
        raise LevelError("Level code is truncated")
    if parts[0] != str(PAYLOAD_VERSION):
        raise LevelError("Unsupported level code version %s" % parts[0])
    objects = []
    for tok in parts[7:]:
        if not tok:
            continue
        f = tok.split(".")
        if len(f) < 3 or len(f) > 5:
            raise LevelError('Malformed object token "%s"' % tok)
        obj = {
            "t": _from36(f[0], "object type"),
            "x": _from36(f[1], "x coordinate"),
            "y": _from36(f[2], "y coordinate"),
        }
        if len(f) >= 4 and f[3] != "":
            obj["r"] = _from36(f[3], "rotation")
        if len(f) >= 5 and f[4] != "":
            obj["p"] = _from36(f[4], "param")
        objects.append(obj)
    level = {
        "name": sanitize_name(parts[1]),
        "author": sanitize_name(parts[2]),
        "songId": _from36(parts[3], "song id"),
        "themeId": _from36(parts[4], "theme id"),
        "difficulty": _from36(parts[5], "difficulty"),
        "length": _from36(parts[6], "length"),
        "objects": objects,
    }
    if not level["name"]:
        raise LevelError("Level code has no name")
    validate(level)
    return level


def encode(level):
    """Level dict -> shareable code (used by seed.py / tests)."""
    validate(level)
    parts = [
        str(PAYLOAD_VERSION),
        sanitize_name(level["name"]),
        sanitize_name(level["author"]),
        _to36(level["songId"]),
        _to36(level["themeId"]),
        _to36(level["difficulty"]),
        _to36(level["length"]),
    ]
    for o in level["objects"]:
        rot = o.get("r", 0) or 0
        par = o.get("p", 0) or 0
        tok = "%s.%s.%s" % (_to36(o["t"]), _to36(o["x"]), _to36(o["y"]))
        if par:
            tok += ".%s.%s" % (_to36(rot), _to36(par))
        elif rot:
            tok += "." + _to36(rot)
        parts.append(tok)
    payload = ";".join(parts)
    b64 = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    crc = "%08x" % (zlib.crc32(payload.encode("utf-8")) & 0xFFFFFFFF)
    return "%s:%s:%s" % (MAGIC, b64, crc)


def _to36(n):
    n = int(n)
    if n < 0:
        raise LevelError("to36 expects a non-negative integer")
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if n == 0:
        return "0"
    out = ""
    while n:
        out = digits[n % 36] + out
        n //= 36
    return out


def validate(level, lenient_overflow=False):
    """Mirror of GD.level.validate — raises LevelError with a clear message."""
    if not isinstance(level, dict):
        raise LevelError("Level is not an object")
    name = level.get("name")
    if not isinstance(name, str) or not name:
        raise LevelError("Level name missing")
    if len(name) > MAX_NAME:
        raise LevelError("Level name too long (max %d)" % MAX_NAME)
    author = level.get("author")
    if not isinstance(author, str) or len(author) > MAX_NAME:
        raise LevelError("Invalid author")
    song = int(level.get("songId", 0))
    if not (0 <= song < MAX_SONGS):
        raise LevelError("Unknown song id %s" % level.get("songId"))
    theme = int(level.get("themeId", 0))
    if not (0 <= theme < MAX_THEMES):
        raise LevelError("Unknown theme id %s" % level.get("themeId"))
    difficulty = int(level.get("difficulty", 1))
    if not (0 <= difficulty < MAX_DIFFICULTIES):
        raise LevelError("Unknown difficulty %s" % level.get("difficulty"))
    length = int(level.get("length", 0))
    if not (MIN_LENGTH <= length <= MAX_LENGTH):
        raise LevelError("Level length must be %d-%d units" % (MIN_LENGTH, MAX_LENGTH))
    objects = level.get("objects")
    if not isinstance(objects, list):
        raise LevelError("Level objects missing")
    if len(objects) > MAX_OBJECTS:
        raise LevelError("Too many objects (max %d)" % MAX_OBJECTS)

    for i, o in enumerate(objects):
        if not isinstance(o, dict):
            raise LevelError("Bad object at index %d" % i)
        d = _DEFS.get(o.get("t"))
        if d is None:
            raise LevelError("Unknown object type %s at index %d" % (o.get("t"), i))
        x = o.get("x")
        if not isinstance(x, int) or isinstance(x, bool) or x < 0 or x > MAX_X:
            raise LevelError("Invalid x coordinate %s at index %d" % (x, i))
        y = o.get("y")
        if not isinstance(y, int) or isinstance(y, bool) or y < 0 or y > MAX_Y:
            raise LevelError("Invalid y coordinate %s at index %d" % (y, i))
        if y + d["h"] > LEVEL_HEIGHT:
            raise LevelError("Object at index %d pokes above the ceiling" % i)
        r = o.get("r", 0) or 0
        if not (0 <= r <= 3):
            raise LevelError("Invalid rotation %s" % o.get("r"))
        p = o.get("p", 0) or 0
        if not (0 <= p <= 65535):
            raise LevelError("Invalid param %s" % o.get("p"))
        if x > length + LENGTH_OVERFLOW and not lenient_overflow:
            raise LevelError("Object at index %d is beyond the level end" % i)


if __name__ == "__main__":
    # Quick self-check: decode every official level from the game source.
    official = os.path.join(HERE, "..", "game", "js", "levels", "official.js")
    if os.path.exists(official):
        with open(official, "r", encoding="utf-8") as f:
            src = f.read()
        for code in re.findall(r'"code":\s*"(NDL1:[^"]+)"', src):
            lv = decode(code)
            print("ok  %-16s %3d objects, length %d" % (lv["name"], len(lv["objects"]), lv["length"]))

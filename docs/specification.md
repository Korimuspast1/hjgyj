# Neon Dash — Specification

A Geometry Dash-inspired auto-runner rhythm platformer: HTML5 game
(Canvas), Android app (WebView shell), online level sharing (Python API
server + stats website). All in-repo, no proprietary dependencies.

## 1. Gameplay

- **Auto-runner cube** at GD-tuned physics: base speed 10.4 units/s,
  jump apex ≈ 2.05 units, airtime ≈ 0.5 s, hold-to-jump (buffered taps),
  forgiving lethal hitboxes (0.25 inset), corner-clip landing tolerance.
- **Hazards**: spikes (triangle hitboxes, 4 rotations), saws (circle
  hitboxes), mines, moving hazards (packed sine movement, horizontal or
  vertical, amplitude/period/phase).
- **Interactions**: solid blocks (land on top, die on walls), pass-through
  platforms, yellow pads, orbs (tap-buffered), gravity portals, speed
  portals (1x/2x/…), finish line with progress %, instant respawn with
  attempt counter.
- **4 official levels** (Neon Genesis ★1, Circuit Breaker ★2, Voltage ★4,
  Hyperdrive ★8), each verified completable by the built-in bot
  (`game/js/logic/bot.js`) — enforced by tests.
- **Player customisation**: primary/secondary cube colours, nickname.

## 2. UI (touch-first, 3-button main menu)

- Main menu with exactly **Play / Settings / Editor** buttons, animated
  background (scrolling parallax + bouncing cube).
- **Level select**: three tabs — Official (progress bars, attempts,
  stars), My Levels (edit/delete), Online (search, sort, download, like,
  upload).
- **Settings**: music/SFX volume, vibration toggle + test, language
  (English / Español / Deutsch), colour pickers with live icon preview,
  nickname, server URL, reset progress (with confirmation).
- **Game screen**: progress bar, %, attempt counter, pause (button or
  hardware back), death/respawn, win dialog with stats.
- **Editor**: place/select/delete tools, drag-paint, pinch zoom, pan,
  56-object palette in 7 categories, per-object rotation + movement
  params, level settings (name/theme/song/difficulty/length), undo/redo
  (200 steps), save/load, export/import via level codes (share sheet on
  Android), test-play with round-trip back to the editor, unsaved-changes
  guard.
- All in-game text in English; ES/DE translations ship and are verified to
  have identical key sets.

## 3. Level codes (share format)

`NDL1:<base64url(payload)>:<crc32-hex>`, payload =
`1;name;author;song;theme;difficulty;length;obj…` with base-36 object
tokens `t.x.y[.r[.p]]`. Corrupted codes must fail with precise errors
(checksum mismatch, unknown object, beyond level end, …). Mirrored
byte-for-byte in Python (`server/ndl.py`) — enforced by tests on both
sides.

## 4. Online (client `game/js/ui/net.js`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/levels?q=&sort=new\|likes\|downloads\|plays&page=&limit=` | browse/search |
| POST | `/api/levels` `{name, author, code}` | upload (validates code; dedup) |
| GET | `/api/levels/<id>` | metadata (+views) |
| GET | `/api/levels/<id>/download` | full code (+downloads) |
| POST | `/api/levels/<id>/like` `{value: 1\|-1}` | like/unlike |
| POST | `/api/levels/<id>/events` `{type: attempt\|complete}` | play stats |
| GET | `/api/stats` | totals + top 10 + recent 10 |

Offline is a first-class state: every call resolves `{ok, data, status}`
without throwing and the UI shows a "cannot reach server" hint.

## 5. Server (`server/app.py`)

Python 3.8+ **standard library only** (http.server + sqlite3): threaded,
CORS-open, 256 KB body cap, path-traversal-safe static hosting of the
website (`/`) and the playable web build (`/play/`). Seeding via
`server/seed.py` (official levels extracted from the game source + demo
community levels).

## 6. Website (`web/index.html`)

Leaderboard/stats page in the game's visual style: totals, top-by-likes
board, fresh uploads; auto-refreshes every 30 s. Links to `/play/`.

## 7. Android (`android/`)

Gradle-free, SDK-free build: `aapt2` (npm `aaptjs3`) + `ecj`/`d8`/
`apksigner`/`android.jar` (npm `@drxiaozhi/minapk`) + any Java 11+ JRE.
One fullscreen `WebView` activity (`com.neondash.game`, minSdk 24,
targetSdk 34) hosting `assets/www/` with:

- `AndroidBridge.vibrate(ms) / exitApp() / shareText(text, subject)`
- `window.onAndroidBack/Pause/Resume` callbacks from the shell
- baked-in default server URL (`window.ND_CONFIG`) at build time
- launcher icons at all densities, INTERNET + VIBRATE permissions
- signed with a generated release keystore (v1+v2)

`bash android/build-apk.sh [SERVER_URL]` → `dist/neon-dash.apk`.

## 8. Tests

- **Node** (`tests/run-tests.js`, zero-dep runner + jsdom): 101 tests —
  unit (encoding, collision, physics, gameplay session, level model,
  object defs, RNG, i18n, storage, official levels + bot) and UI (menu,
  settings, level select, online with mocked transport, editor, gameplay
  through the real rAF loop).
- **Python** (`server/test_server.py`, unittest): 18 tests — codec
  round-trips/rejections (incl. hostile payloads), every API endpoint,
  pagination, dedup, static hosting, traversal protection.

Run: `cd tests && node run-tests.js` · `python3 server/test_server.py`.

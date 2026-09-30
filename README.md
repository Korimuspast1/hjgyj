# Neon Dash

A **Geometry Dash-inspired rhythm platformer**: auto-runner cube, spikes,
saws, portals, pads and orbs — with a full level editor (56-object palette),
online level sharing, a stats website and a signed Android APK.
Built as an HTML5 Canvas game wrapped in an Android WebView shell.

![tests](https://img.shields.io/badge/tests-101%20node%20%2B%2018%20python-brightgreen)

## What's inside

| Path | What it is |
|---|---|
| `game/` | The game (vanilla JS, no build step, no dependencies) — open `game/index.html` to play |
| `server/` | Online API + static hosting — Python 3.8+, **standard library only** (http.server + sqlite3) |
| `web/` | Stats & leaderboard website served at `/` |
| `android/` | WebView shell + Gradle-free, SDK-free APK build |
| `dist/neon-dash.apk` | Signed release APK |
| `tests/` | 101 Node tests (zero-dep runner + jsdom) |
| `server/test_server.py` | 18 Python tests (codec + API) |
| `docs/specification.md` | Full specification |

## Quick start

```sh
# play in a browser right now
python3 -m http.server -d game 8080        # → http://localhost:8080

# or run the full stack: website + web player + online levels API
python3 server/seed.py                     # official + demo levels
python3 server/app.py --port 8080          # → http://localhost:8080
#   /       stats website      /play/  playable web build
#   /api/…  REST API (see docs/specification.md)
```

The game works fully **offline** (progress and custom levels live in
localStorage); the server adds browsing, upload, download, likes and stats.

### Android APK

```sh
bash android/fetch-tools.sh               # one-time: aapt2 + ecj/d8/apksigner (npm)
bash android/build-apk.sh "https://your-server.example.com"
# → dist/neon-dash.apk  (signed, minSdk 24 / targetSdk 34)
```

The build needs no Android SDK or Gradle — just `zip`, `python3`, `node`
(for fetching the tools) and any Java 11+ runtime. The optional argument
bakes the default online server URL into the app.

### Tests

```sh
cd tests && npm install        # jsdom (dev-only)
node run-tests.js              # all 101 (or: node run-tests.js unit | ui)
python3 server/test_server.py  # 18 server tests
```

The unit suite runs the real physics/collision/encoding code headless; the
UI suite boots the actual game in jsdom and clicks through menus, settings,
level select, the editor (canvas pointer events) and full gameplay loops.
Every official level must be completable by the built-in verification bot
(`game/js/logic/bot.js`) or the build fails.

## Architecture

```
game/js/core      namespace, util, rng, i18n, storage, objectdefs,
                  level, encoding, collision, physics, audio (synth)
game/js/logic     gameplay session, verification bot
game/js/render    sprites, background, level renderer, player icon (canvas)
game/js/ui        screens, level select, editor, net client
game/js/boot.js   app wiring: audio, music, menu bg, Android bridge hooks

server/app.py     REST API + static hosting (threaded, CORS, sqlite)
server/ndl.py     Python mirror of the level-code codec & validator
android/          WebView shell; build-apk.sh = aapt2 → ecj → d8 → zip → sign
```

- **Deterministic simulation**: fixed 1/240 s substeps; the same code runs
  the on-screen game, the editor test mode and the headless bot.
- **Level codes** (`NDL1:<base64>:<crc32>`) are the universal share format:
  editor export/import, server storage and the Android share sheet all use
  the same validated bytes (JS and Python implementations are test-locked
  to each other).
- **No tracking, no accounts**: the server is anonymous (nickname +
  self-reported stats).

## License notes

Game code: MIT. Titan One font (Pusab-like) — SIL OFL, vendored in
`game/assets/font/` and embedded as base64 in `game/css/font.css`.

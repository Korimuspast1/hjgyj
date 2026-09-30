#!/usr/bin/env bash
#
# Build dist/neon-dash.apk — the signed Android package of the game.
#
# Gradle-free / SDK-free pipeline:
#   1. stage game/ into android build assets (injecting the server URL)
#   2. aapt2 compile + link  -> base APK (binary manifest + resources.arsc)
#   3. ecj (Eclipse compiler) -> .class, d8 -> classes.dex
#   4. zip classes.dex + assets into the APK
#   5. keytool (generate keystore once) + apksigner (v1+v2) -> signed APK
#
# Usage:
#   bash android/build-apk.sh [SERVER_URL]
#
#   SERVER_URL  baked-in default API server, e.g. https://example.com
#               (empty = offline-only build; users can still set it in-game)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
TOOLS="$HERE/tools"
BUILD="$HERE/build"
DIST="$ROOT/dist"
SERVER_URL="${1:-${SERVER_URL:-}}"

# --- java runtime -----------------------------------------------------------
if [ -z "${JAVA_HOME:-}" ]; then
  if command -v java >/dev/null 2>&1; then
    JAVA_HOME="$(dirname "$(dirname "$(command -v java)")")"
  elif [ -x /usr/local/lib/python3.11/dist-packages/jdk4py/java-runtime/bin/java ]; then
    JAVA_HOME=/usr/local/lib/python3.11/dist-packages/jdk4py/java-runtime
  fi
fi
JAVA="$JAVA_HOME/bin/java"
KEYTOOL="$JAVA_HOME/bin/keytool"
"$JAVA" -version >/dev/null 2>&1 || { echo "ERROR: java not available" >&2; exit 1; }

# --- tools -------------------------------------------------------------------
if [ ! -x "$TOOLS/aapt2" ]; then
  echo "build tools missing — fetching them first..."
  bash "$HERE/fetch-tools.sh"
fi
AAPT2="$TOOLS/aapt2"
ANDROID_JAR="$TOOLS/android.jar"
D8_JAR="$TOOLS/d8.jar"
APKSIGNER="$TOOLS/apksigner.jar"
ECJ_JAR="$TOOLS/ecj.jar"

echo "==> 1/6 staging game assets (server URL: '${SERVER_URL:-<offline>}')"
rm -rf "$BUILD"
mkdir -p "$BUILD/assets/www" "$BUILD/compiled" "$BUILD/dex" "$DIST"

cp -r "$ROOT/game/." "$BUILD/assets/www/"
# bake the default server URL into the boot config
python3 - "$BUILD/assets/www/index.html" "$SERVER_URL" <<'PY'
import json, re, sys
path, server = sys.argv[1], sys.argv[2]
html = open(path, encoding='utf-8').read()
replacement = 'window.ND_CONFIG = %s;' % json.dumps({'serverUrl': server})
html2, n = re.subn(r"window\.ND_CONFIG\s*=\s*\{[^}]*\};", replacement, html, count=1)
if n == 0:
    raise SystemExit('ND_CONFIG not found in index.html')
open(path, 'w', encoding='utf-8').write(html2)
print('injected:', replacement)
PY

echo "==> 2/6 aapt2: compile resources"
"$AAPT2" compile --dir "$HERE/res" -o "$BUILD/compiled/res.zip"

echo "==> 3/6 aapt2: link (manifest + resources -> base APK)"
"$AAPT2" link \
  -o "$BUILD/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$HERE/AndroidManifest.xml" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name 1.0.0 \
  --auto-add-overlay \
  "$BUILD/compiled/res.zip"

echo "==> 4/6 ecj + d8: compile MainActivity -> classes.dex"
"$JAVA" -jar "$ECJ_JAR" -source 8 -target 8 -nowarn \
  -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD/dex" \
  "$HERE/java/com/neondash/game/MainActivity.java"
find "$BUILD/dex" -name '*.class' > "$BUILD/classlist.txt"
"$JAVA" -cp "$D8_JAR" com.android.tools.r8.D8 \
  --release --min-api 24 \
  --lib "$ANDROID_JAR" \
  --output "$BUILD" \
  $(cat "$BUILD/classlist.txt")

echo "==> 5/6 packaging"
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
(cd "$BUILD" && zip -q -u unsigned.apk classes.dex)
(cd "$BUILD/assets" && zip -q -r -u "$BUILD/unsigned.apk" www)

echo "==> 6/6 signing"
KS="$HERE/tools/nd-release.keystore"
if [ ! -f "$KS" ]; then
  echo "generating release keystore (tools/nd-release.keystore)..."
  "$KEYTOOL" -genkeypair -keystore "$KS" -storepass neondash -keypass neondash \
    -alias neondash -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Neon Dash, OU=Game, O=NeonDash, C=EE" >/dev/null 2>&1
fi
"$JAVA" -jar "$APKSIGNER" sign \
  --ks "$KS" --ks-pass pass:neondash --key-pass pass:neondash \
  --ks-key-alias neondash \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$DIST/neon-dash.apk" \
  "$BUILD/unsigned.apk"
"$JAVA" -jar "$APKSIGNER" verify --print-certs "$DIST/neon-dash.apk" | head -4

ls -la "$DIST/neon-dash.apk"
echo "OK: $DIST/neon-dash.apk"

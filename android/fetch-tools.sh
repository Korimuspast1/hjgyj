#!/usr/bin/env bash
#
# Fetch the (git-ignored) Android build toolchain into android/tools/.
#
# The build is Gradle-free and SDK-free: it needs only
#   - aapt2      (native, from the npm package `aaptjs3`)
#   - android.jar, d8.jar, ecj, apksigner.jar (from the npm package
#     `@drxiaozhi/minapk`)
#   - a Java 11+ runtime (java / keytool on PATH; the test sandbox ships
#     jdk4py, which is picked up automatically)
#
# Usage: bash android/fetch-tools.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TOOLS="$HERE/tools"
mkdir -p "$TOOLS"

# --- locate a Java runtime -------------------------------------------------
if [ -z "${JAVA_HOME:-}" ]; then
  if command -v java >/dev/null 2>&1; then
    JAVA_HOME="$(dirname "$(dirname "$(command -v java)")")"
  elif [ -x /usr/local/lib/python3.11/dist-packages/jdk4py/java-runtime/bin/java ]; then
    # jdk4py (present in the Arena sandbox)
    JAVA_HOME=/usr/local/lib/python3.11/dist-packages/jdk4py/java-runtime
  else
    echo "ERROR: no Java runtime found (need java + keytool)." >&2
    exit 1
  fi
fi
echo "JAVA_HOME=$JAVA_HOME"

need() { [ -s "$1" ]; }

if need "$TOOLS/aapt2" && need "$TOOLS/android.jar" && need "$TOOLS/d8.jar" \
   && need "$TOOLS/apksigner.jar" && need "$TOOLS/ecj.jar"; then
  echo "tools already present in $TOOLS"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "downloading aaptjs3 (aapt2 binary)..."
npm pack aaptjs3 --pack-destination "$TMP" >/dev/null
tar xzf "$TMP"/aaptjs3-*.tgz -C "$TMP"
AAPT2_SRC="$(find "$TMP"/package/bin -type f -name aapt2 | grep -m1 "$(uname -m)")"
[ -n "$AAPT2_SRC" ] || AAPT2_SRC="$(find "$TMP"/package/bin -type f -name aapt2 | head -1)"
cp "$AAPT2_SRC" "$TOOLS/aapt2"
chmod +x "$TOOLS/aapt2"

echo "downloading @drxiaozhi/minapk (android.jar, d8, apksigner, ecj)..."
npm pack @drxiaozhi/minapk --pack-destination "$TMP" >/dev/null
tar xzf "$TMP"/drxiaozhi-minapk-*.tgz -C "$TMP"
cp "$TMP"/package/tools/android.jar      "$TOOLS/android.jar"
cp "$TMP"/package/tools/d8.jar           "$TOOLS/d8.jar"
cp "$TMP"/package/tools/apksigner.jar    "$TOOLS/apksigner.jar"
cp "$TMP"/package/tools/ecj-*.jar        "$TOOLS/ecj.jar"

ls -la "$TOOLS"
echo "done."

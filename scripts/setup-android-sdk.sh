#!/bin/bash
# Installs the Android SDK needed to build the APK (`npm run android:apk`).
# On demand only: it downloads ~1 GB between SDK and Gradle dependencies.
# Requires JDK 21. Idempotent: does nothing if everything is already there.
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"

if [ ! -x "$SDKMANAGER" ]; then
  echo "Scarico gli Android command-line tools in $ANDROID_HOME…"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  zip_name=$(curl -fsSL https://dl.google.com/android/repository/repository2-3.xml \
    | grep -o 'commandlinetools-linux-[0-9]*_latest.zip' | head -1)
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/tools.zip" "https://dl.google.com/android/repository/$zip_name"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  rm -rf "$tmp"
fi

# Versions from android/variables.gradle (compileSdk 36); AGP also wants build-tools 35.
yes | "$SDKMANAGER" --licenses > /dev/null 2>&1 || true
"$SDKMANAGER" --install "platforms;android-36" "build-tools;36.0.0" "build-tools;35.0.0" "platform-tools" > /dev/null

echo "sdk.dir=$ANDROID_HOME" > "$ROOT/android/local.properties"
echo "Android SDK pronto in $ANDROID_HOME. Ora: npm run android:apk"

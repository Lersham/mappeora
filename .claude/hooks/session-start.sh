#!/bin/bash
# Prepares Claude Code cloud sessions: installs the npm dependencies so that
# typecheck, tests and the dev server work right away.
# The Android SDK is NOT installed here (hundreds of MB): run
# `npm run setup:android` only when an APK is needed.
set -euo pipefail

# Only in cloud sessions: on a developer's machine dependencies are their business.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install (not ci) reuses node_modules cached with the container.
npm install --no-audit --no-fund

# If the Android SDK is already present (e.g. a resumed container), expose it.
if [ -d /opt/android-sdk ]; then
  echo 'export ANDROID_HOME=/opt/android-sdk' >> "$CLAUDE_ENV_FILE"
fi

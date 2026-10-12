// Builds the debug APK (`npm run android:apk`): gradlew.bat on Windows, ./gradlew elsewhere.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const win = process.platform === 'win32';
// Without ANDROID_HOME, the SDK that `npm run setup:android` installs (Linux).
const env = { ...process.env };
if (!env.ANDROID_HOME && !win) env.ANDROID_HOME = '/opt/android-sdk';

const run = spawnSync(win ? 'gradlew.bat' : './gradlew', ['assembleDebug'], {
  cwd: fileURLToPath(new URL('../android', import.meta.url)),
  env,
  stdio: 'inherit',
  shell: win, // .bat files need a shell on Windows
});
process.exit(run.status ?? 1);

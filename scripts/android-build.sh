#!/usr/bin/env bash
# Builds the signed Android App Bundle (.aab) for Google Play from android/twa-manifest.json.
#   npm run android:build
# Needs (see android/RELEASE.md): JDK 17, the Android SDK (platform 36 + build-tools 36.1.0), @bubblewrap/cli 1.25.0,
# your UPLOAD keystore at android/upload.keystore, and BUBBLEWRAP_KEYSTORE_PASSWORD / BUBBLEWRAP_KEY_PASSWORD in the environment.
# The keystore and passwords are never stored in the repository.
set -euo pipefail
cd "$(dirname "$0")/../android"

: "${BUBBLEWRAP_KEYSTORE_PASSWORD:?set BUBBLEWRAP_KEYSTORE_PASSWORD (your upload keystore password)}"
: "${BUBBLEWRAP_KEY_PASSWORD:?set BUBBLEWRAP_KEY_PASSWORD (your upload key password)}"
[ -f upload.keystore ] || { echo "android/upload.keystore not found: create it as described in android/RELEASE.md (never commit it)"; exit 1; }

BW="npx --yes @bubblewrap/cli@1.25.0"
$BW update --skipVersionUpgrade

# Bubblewrap 1.25 ships Android Gradle Plugin 8.9.1, which cannot see the Android 16 (API 36) platform that Google Play
# now requires. 8.10.1 can. (Remove this line once Bubblewrap ships a newer template.)
sed -i.bak "s/com.android.tools.build:gradle:8\.9\.1/com.android.tools.build:gradle:8.10.1/" build.gradle && rm -f build.gradle.bak

$BW build --skipPwaValidation

BT="${ANDROID_HOME:-$HOME/android-sdk}/build-tools/36.1.0"
echo; echo "── What was built ──"
"$BT/aapt2" dump badging app-release-signed.apk | egrep "^package:|targetSdkVersion|uses-permission|application-label:"
echo; echo "Upload this file to Google Play:  $(pwd)/app-release-bundle.aab"

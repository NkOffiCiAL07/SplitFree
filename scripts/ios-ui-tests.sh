#!/usr/bin/env bash
# Drive the installed iPhone app like a user (launch, type, deep link, sign in) and save screenshots to /tmp/splitr-ui:
#   scripts/ios-ui-tests.sh [device name]      (run scripts/ios-run-sim.sh first so the app is installed)
set -uo pipefail
DEVICE="${1:-iPhone 17}"
cd "$(dirname "$0")/.."
UDID=$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
rm -rf /tmp/splitr-ui /tmp/splitr-ui-result.xcresult; mkdir -p /tmp/splitr-ui
# Start every run from a freshly installed app (no leftover signed-in session from an earlier run)
APP=/tmp/splitr-dd/Build/Products/Debug-iphonesimulator/App.app
[ -d "$APP" ] || { echo "Build the app first: scripts/ios-run-sim.sh"; exit 1; }
# (the simulator keeps a web view's cookies even after an uninstall, so wipe the whole simulator)
xcrun simctl shutdown "$UDID" 2>/dev/null || true
xcrun simctl erase "$UDID"
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b >/dev/null
sleep 45 # let a freshly erased simulator settle (otherwise the UI-test runner can time out on accessibility start-up)
xcrun simctl install "$UDID" "$APP"
node scripts/ui-test-account.mjs create || exit 1
xcodebuild test -project ios/UITests/UITests.xcodeproj -scheme SplitrUITests -destination "platform=iOS Simulator,id=$UDID" \
  ${ONLY_TESTING:+-only-testing:$ONLY_TESTING} -derivedDataPath /tmp/splitr-ui-dd -resultBundlePath /tmp/splitr-ui-result.xcresult CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "Test Case|error:|passed|failed|TEST|WEBVIEW|\*\*" | tail -40
STATUS=${PIPESTATUS[0]}
node scripts/ui-test-account.mjs delete
ls /tmp/splitr-ui/*.png 2>/dev/null
exit $STATUS

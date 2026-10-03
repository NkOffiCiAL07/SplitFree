#!/usr/bin/env bash
# Build the iPhone app, install it on a simulator and launch it:   scripts/ios-run-sim.sh [device name] [server url]
# Example: scripts/ios-run-sim.sh "iPhone 17" http://localhost:3000
set -euo pipefail
DEVICE="${1:-iPhone 17}"
[ -n "${2:-}" ] && export CAP_SERVER_URL="$2"
cd "$(dirname "$0")/.."
UDID=$(xcrun simctl list devices available | grep -F "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
[ -n "$UDID" ] || { echo "No simulator named '$DEVICE'"; exit 1; }
npx cap sync ios >/dev/null
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath /tmp/splitr-dd CODE_SIGNING_ALLOWED=NO build -quiet
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl terminate "$UDID" com.splitfree.app 2>/dev/null || true
xcrun simctl install "$UDID" /tmp/splitr-dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$UDID" com.splitfree.app
echo "Launched on $DEVICE ($UDID). Screenshot: xcrun simctl io $UDID screenshot out.png"

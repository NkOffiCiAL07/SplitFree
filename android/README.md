# Android app (Trusted Web Activity)

The Android app is a thin, signed wrapper that opens the live site full-screen. **Almost every change you make to the
website reaches Android users immediately** — no new APK needed. You only rebuild the APK to change things baked into
it: the launcher icon, app name, splash colour, version number, or the start URL.

## What makes it feel native (already set up)
- `public/.well-known/assetlinks.json` ties the site to the APK's signing key. **This is what hides the browser address
  bar and lets invite links (WhatsApp etc.) open inside the app.** It must contain the SHA-256 of whatever key signs the
  APK people install.
- The web manifest (`public/manifest.json`) supplies shortcuts (long-press the app icon), theme colours and categories.

## Rebuilding the APK
1. `npm i -g @bubblewrap/cli` (needs a JDK; Bubblewrap offers to download the Android SDK).
2. In this folder, put your **existing keystore** next to `twa-manifest.json` as `splitfree.keystore` (alias `my-key-a`).
   Use the SAME keystore every time: people can only update an installed app if it's signed with the same key.
3. Raise `appVersionCode` (+1) and `appVersion` in `twa-manifest.json`, then:
   ```
   cd android
   bubblewrap update      # regenerates the Android project from twa-manifest.json
   bubblewrap build       # produces app-release-signed.apk
   ```
4. Publish it from the repo root — this checks the signing key, copies the file and updates the checksum shown on the
   landing page:
   ```
   npm run apk:update -- android/app-release-signed.apk
   npm test && git add -A && git commit -m "android: new build" && git push && vercel --prod --yes
   ```

## If you move to Google Play
Play re-signs your app with its own key ("Play App Signing"). Add **Play's** SHA-256 (Play Console → App integrity) to
`assetlinks.json` as a second entry, and keep the current one for people who installed the APK directly.

## Checklist before a release
- [ ] Signed with the same keystore (the script checks this against `assetlinks.json`)
- [ ] `appVersionCode` is higher than the previous release
- [ ] Opened on a real phone: no address bar at the top, sign-in works, a WhatsApp invite link opens in the app

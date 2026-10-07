# Releasing Splitr on Google Play (Android App Bundle)

The Android app is a **Trusted Web Activity**: a small signed shell that opens https://www.splitr.pro full-screen. Website changes reach the app instantly. You only build a new bundle (`.aab`) to change things baked into the shell (icon, name, version, start URL) or when Google raises the target API level.

Current configuration (`android/twa-manifest.json`): package `com.splitfree.app` (keep it: it is what the website's `assetlinks.json` and any existing installs are tied to), host `www.splitr.pro` (**must be `www.`**: the bare domain redirects, which breaks verification), name **Splitr**, version **1.2.0 (code 3)**, **target API 36** (Android 16: Google Play's requirement for new apps and updates since 31 Aug 2026).

## 1. One-time tools
```
brew install openjdk@17                  # Bubblewrap needs JDK 17 exactly
# Bubblewrap also wants the command-line tools directly in the SDK root (bin/ and lib/ next to platforms/)
npm i -g @bubblewrap/cli@1.25.0
bubblewrap updateConfig --jdkPath /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk --androidSdkPath "$HOME/android-sdk"
```
Android SDK: command-line tools plus `platforms;android-36` and `build-tools;36.1.0` (Bubblewrap can download these for you the first time you run `bubblewrap doctor`).

## 2. Create your UPLOAD key (once, by you, never committed)
```
mkdir -p ~/splitr-keys && cd ~/splitr-keys
keytool -genkeypair -v -keystore upload.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Splitr, O=<your name or company>, C=IN"
```
- Choose a strong password; keep **upload.keystore and the passwords in a password manager, and a second backup copy**. Never put them in Git (`*.keystore`/`*.jks` are git-ignored).
- With **Play App Signing** (the default, and required for new apps) Google holds the real app-signing key. This upload key only proves *you* uploaded the bundle, and if you lose it Google can reset it. Use a **new** upload key; do not reuse the old sideload key unless you want to.
- Copy the keystore next to the manifest as `android/upload.keystore` (git-ignored) or edit `signingKey.path` in `twa-manifest.json`.

## 3. Build the bundle
```
export BUBBLEWRAP_KEYSTORE_PASSWORD='…'
export BUBBLEWRAP_KEY_PASSWORD='…'
npm run android:build                    # → android/app-release-bundle.aab  (upload this)
```
The script regenerates the Android project from `twa-manifest.json`, builds, and prints the package, target API and permissions. (Bubblewrap 1.25 ships an Android Gradle Plugin that cannot see the Android 16 platform, so the script raises it to 8.10.1.)

Raise `appVersionCode` (+1 for every upload) and `appVersion` in `twa-manifest.json` first.

## 4. Check the generated manifest
Before uploading, confirm nothing unexpected was added:
```
$ANDROID_HOME/build-tools/36.1.0/aapt2 dump badging app-release-signed.apk | egrep "package:|targetSdkVersion|uses-permission|launchable-activity"
```
Expected: package `com.splitfree.app`, `targetSdkVersion:'36'`, permissions limited to `INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`. No camera/location/contacts/storage/install-packages.

## 5. Play Console (manual)
1. Create the app (name **Splitr**, free, default language English (India or US)) and accept the declarations.
2. **App integrity → Play App Signing**: enrol; on the first upload Google generates the app-signing key.
3. Upload `app-release-bundle.aab` to **Internal testing** first; install from the testing link on a real phone.
4. **Digital Asset Links (this is what removes the browser address bar).** In Play Console → *App integrity* copy the **App signing key certificate SHA-256**. Add it as a second fingerprint in `public/.well-known/assetlinks.json` (keep the existing one for people who installed the old APK directly), commit and deploy:
   ```json
   "sha256_cert_fingerprints": ["E3:0D:…:E7:86", "<PLAY APP SIGNING SHA-256>"]
   ```
   Open the app from the testing link: there must be **no URL bar**. If there is, the fingerprint is wrong or not deployed yet.
5. Complete the forms using `play-store/*.md`: Store listing, Data safety, Content rating, Target audience, App access (reviewer test account), Ads (none), Privacy policy URL, Account deletion URL.
6. Promote to **Production**. Google's review typically takes a few days for a first app.

## Existing sideloaded users
People who installed `SplitFree.apk` from the website are signed with a different key, so the Play version cannot update that install: they uninstall and install from Play (their data is on the server). Keep the APK download page until most have moved.

## Every release checklist
- [ ] `appVersionCode` higher than the last upload
- [ ] Built from a clean checkout; `npm run check:live` passes against https://www.splitr.pro
- [ ] Bundle opened on a real phone: no address bar, sign-in works, an invite link opens in the app

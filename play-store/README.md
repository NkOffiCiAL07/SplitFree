# Splitr: Google Play release report (7 Oct 2026)

Architecture: **Trusted Web Activity** (a signed Android shell, built with Bubblewrap, that opens https://www.splitr.pro full-screen). Not React Native/Capacitor/native. Package `com.splitfree.app` (kept: tied to `assetlinks.json` and existing installs), version **1.2.0 (code 3)**, **target API 36**, min API 21.

Files in this folder: `listing.md` (store text), `data-safety.md`, `content-rating-and-audience.md`, `permissions-and-security.md`, `screenshots.md` + `assets/` (6 screenshots, feature graphic, icon). Build and signing: `../android/RELEASE.md`, `npm run android:build`.

## 1. READY
- Production target: the app opens **https://www.splitr.pro** (HTTPS); `assetlinks.json` is served there (HTTP 200, JSON). No staging/localhost/debug URLs, no `console.log`, no test accounts or bypasses in `src/`.
- **Target API 36** (Google's requirement since 31 Aug 2026), verified in the built package (`aapt2`: `targetSdkVersion:'36'`); not debuggable; app label **Splitr**.
- Permissions: only `POST_NOTIFICATIONS` (+ the library's internal receiver permission). No camera/location/contacts/storage/mic.
- Icons: full-bleed adaptive icon (coin inside the safe zone), **monochrome themed icon**, rounded splash icon, 512×512 store icon, 1024×500 feature graphic.
- Privacy policy (accurate, 7 Oct 2026): https://www.splitr.pro/privacy. **Account deletion page**: https://www.splitr.pro/delete-account (public, explains in-app path, settle-up rule, what is deleted and what stays) and in-app *Settings → Delete account*.
- Store listing text, Data safety answers, content rating, target audience: written from the code (see docs).
- 6 real-UI screenshots + feature graphic generated (`npm run play:assets`).
- Release bundle **builds** (see §5) and **runs on Android 16** (see §6).

## 2. FIXED in this pass
- Privacy policy and support FAQ claimed deletion "removes all your data" and mentioned "usage data" analytics that do not exist: rewritten to match the code (shared expenses stay anonymised; no analytics; named processors: Supabase, Vercel, Google, Resend, push services, Frankfurter).
- Added the public `/delete-account` page (Play requires a web link).
- Removed the profile-photo request to `ui-avatars.com` (it sent the user's name to a third party) and the dead camera button.
- Invite emails/notifications fell back to the old `splitfree-xi.vercel.app` address; now `https://www.splitr.pro`.
- TWA config: host `www.splitr.pro`, name **Splitr**, v1.2.0 (3), proper maskable + monochrome + rounded icons, signing key path moved to an upload key that is *not* in Git; `.gitignore` now blocks keystores/AAB/APK.
- `scripts/android-build.sh` (`npm run android:build`): regenerates + builds + prints package/target/permissions. It also works around Bubblewrap 1.25's Android Gradle Plugin (8.9.1) not recognising API 36 (raised to 8.10.1).
- Removed the landing page's "Careful with money" section (design).

## 3. MANUAL ACTION REQUIRED (Play Console and your accounts)
1. Google Play developer account (one-time fee), identity/organisation verification, accept developer agreements. Create the app **Splitr** (free).
2. **Create your upload keystore** and build the real bundle: `android/RELEASE.md` §2–3. *Never commit the keystore or passwords.* Back it up in two places.
3. Enrol in **Play App Signing** (default); copy the **App signing key SHA-256** from App integrity into `public/.well-known/assetlinks.json` as a second fingerprint (keep the current one), deploy, and confirm the address bar disappears on a real phone.
4. Fill the declarations from `data-safety.md`, `content-rating-and-audience.md`; set the privacy URL, delete-account URL (`/delete-account`), contact email (use a dedicated support address if you have one), category Finance.
5. **App access**: create a reviewer account in production (email + password + mobile number + a sample group) and enter it in Play Console. Do not commit it.
6. Upload screenshots/graphics from `assets/`; paste the text from `listing.md`.
7. Release to **Internal testing** → install on a real phone → promote to Production. (New personal developer accounts may first need a closed test with a minimum number of testers for a set period: check your account's current requirement in Play Console.)
8. Supabase → Authentication → URL Configuration: add `https://splitr.pro/**` and `https://www.splitr.pro/**` (needed for Google sign-in and email links to work in the app).

## 4. BLOCKERS
- **BLOCKER (yours): upload keystore + Play developer account.** I cannot and must not create/store your signing key. Without it the bundle cannot be uploaded.
- **Not a blocker, but plan for it:** people who installed the old `SplitFree.apk` (different signing key) cannot be updated by the Play version; they reinstall from Play (their data is on the server).

## 5. BUILD ARTIFACT
- **Proof build** (signed with a throwaway *test* key, **do not upload**): `/tmp/splitr-twa/app-release-bundle.aab` (1.3 MB). Verified: `com.splitfree.app`, versionCode 3 / 1.2.0, targetSdk 36, not debuggable.
- **The file you upload** is produced on your machine with your key: `npm run android:build` → `android/app-release-bundle.aab`. (After this commit is deployed, the splash uses the rounded icon: rebuild once more with your key.)

## 6. TEST RESULTS
| Check | Result | How |
|---|---|---|
| Build (AAB + APK, target 36) | **PASS** | Bubblewrap 1.25 + Gradle, JDK 17, SDK 36 |
| Release build install + launch (Android 16 emulator, Play image) | **PASS** | no crash/ANR in the device log; splash then live site |
| Login (email, on the release build) | **PASS** | on device: "Welcome back", dashboard loaded |
| Signup, Groups, Expenses, Payments (web app, same code the shell loads) | **PASS** | 1,898 unit/API tests + browser guards on every signed-in page |
| Split types (equal/exact/%/shares), multiple payers, rounding, settle-up | **PASS** | 389 tests incl. explicit checklist scenarios (₹1,000÷4; ₹700+₹300 payers; sum(parts)==total) |
| Group leave / account deletion with balances | **PASS** | refused while unsettled; tests in `account.test.ts`, `members-budget.test.ts` |
| Offline → reopen → sync, duplicate/failed sync/retry | **PASS (tests)** | 85 offline tests incl. chaos/idempotency; real offline banner screenshot |
| Account deletion on the device | **NOT RUN on device** | web flow tested; please run it once on a phone |
| QR join | **N/A in-app** | the app only *shows* QR codes; joining uses the phone's own camera app |
| Push notifications on device, Google sign-in on device | **NOT RUN** | need your Supabase redirect URLs + a real Google account/phone |
| Release build on a real phone | **TODO (yours)** | see §3 step 7 |

## 7. SECURITY
- Secrets detected in repository: **none**. Keystores, `.env*`, build outputs are git-ignored. Release signing: **not configured in Git by design** (your upload key).
- Debug endpoints/test accounts/bypasses: **none found**. HTTPS enforced (all URLs `https://`; cleartext not used). Authentication: Supabase Auth, JWT verified on every API route, per-user rate limits, safe-redirect checks.
- Generated manifest: one exported launcher activity + the standard TWA components; one note: `allowBackup="true"` is Bubblewrap's template default (the shell stores no data; the website's data stays in Chrome). Harmless; revisit if the shell ever stores anything.

## 8. Sources checked
Target API level requirement: developer.android.com/google/play/requirements/target-sdk (API 36 for new apps and updates from 31 Aug 2026; extension to 1 Nov 2026 possible). Re-check Play Console policy pages (Data safety, account deletion, developer verification) at submission time, as they change.

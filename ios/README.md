# iPhone app (Capacitor)

The iPhone app is a native shell (WKWebView) around the live site, started on `/dashboard`. Web releases reach iPhone
users immediately — no App Store review for ordinary changes. You only ship a new build to the App Store for native
changes (icon, plugins, permissions, version).

```
SplitFree/
  capacitor.config.ts        app id, server URL, splash, user-agent token
  ios/App/                   the Xcode project (Swift Package Manager — no CocoaPods)
  ios-web/                   bundled fallback page shown if the site can't be reached at launch
  src/components/shared/native-bridge.tsx   status bar, launch image, deep links
  src/lib/native.ts, haptics.ts             native helpers (all no-ops in a browser)
```

## 1. One-time setup on your Mac
1. Install **Xcode** (App Store, ~12 GB download; plan for ~40 GB free for Xcode + a simulator). Open it once and accept the licence.
2. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. Xcode → Settings → Platforms: make sure an **iOS Simulator** runtime is installed.
4. In the repo: `npm install`

## 2. Run it in the Simulator
```
npm run ios:sim                 # syncs and launches on a simulator (pick one when asked)
npm run ios:sim:local           # same, but loads http://localhost:3000 (run `npm run dev` first)
npm run ios:open                # or open the project in Xcode and press ▶
```
Everything in the simulator talks to the same Supabase/Vercel as the website.

### Test checklist (Simulator)
| Check | How |
|---|---|
| Launch | Purple launch image, then the sign-in page (no white flash) |
| Status bar | White text on the purple sign-in header, dark text on the dashboard |
| Safe areas | iPhone 15 Pro (Dynamic Island) and **iPhone SE** (small): nothing under the notch/home bar |
| Sign in | Email + password works. **No Google button** (Google blocks web views) and no "other app's browser" warning |
| The pot | Fills as you type the form |
| Keyboard | Fields never zoom the page; Return moves email → password → signs in; password manager offers to fill |
| Add expense / settle | Works; you feel a haptic on success (real device only) |
| UPI | On a rupee debt, tap **UPI**: menu with Google Pay / PhonePe / Paytm / Copy UPI ID (apps open only on a real device with them installed) |
| WhatsApp | **Invite on WhatsApp** / **Remind on WhatsApp** open WhatsApp (real device) |
| Deep links | `xcrun simctl openurl booted splitrpro://join/<token>` opens that invite in the app |
| Offline | Settings → Developer → Network Link Conditioner (or Airplane mode on a device): add an expense → "Saved on this device"; reconnect → it syncs |
| Offline at launch | Launch with no network → the bundled "You're offline" page with *Try again* |
| Delete account | Settings → Delete account works (App Store requirement) |
| Dark mode / Dynamic Type | Simulator → Features / Settings → Accessibility |
| Rotation | Locked to portrait on iPhone |

### Automated simulator tests (what was actually run)
```
scripts/ios-run-sim.sh "iPhone 17"     # build (Debug), install and launch the app on that simulator
scripts/ios-ui-tests.sh "iPhone 17"    # XCUITest: drives the app like a user, screenshots to /tmp/splitr-ui/
```
`ios-ui-tests.sh` creates a throw-away Supabase account (`scripts/ui-test-account.mjs`), erases and reboots the
simulator so no old session is left, runs the tests in `ios/UITests`, and deletes the account afterwards.
Verified on an iPhone 17 / iOS 27 simulator: launch → sign-in (email only, no Google, even before the page finishes
loading), typing with the real iOS keyboard (pot fills), `splitrpro://join/…` deep link opens the invite inside the
app, sign-in → dashboard + tabs, still signed in after relaunch, the marketing page never appears in the app.
Gotchas:
- It erases the simulator — don't run it while you are looking at it (the screen goes black while it reboots).
- A freshly erased simulator needs a minute to settle (the script waits); the first page load can take a few minutes.
- This Xcode has no separate Simulator.app; the simulator window lives inside Xcode (or use `xcrun simctl io <udid> screenshot`).
- The full run is slow (about 10 minutes). Run one test with `ONLY_TESTING=SplitrUITests/SplitrUITests/test04_signInAndUseTheApp scripts/ios-ui-tests.sh`.

### Test without Xcode (already automated)
```
npm run build && npm run ios:webkit
```
Runs the sign-in and landing pages in a real **WebKit** engine with iPhone SE / 13 / 15 / 15 Pro Max profiles, in both
"Safari" and "inside the app" modes, and saves screenshots to `ios/simulation/`. It checks sideways scrolling, 16px
inputs (no focus-zoom), 44px+ touch targets, that Sign in is above the fold, Google hidden in the app, no JavaScript
errors, and the iPhone install steps. It cannot test the native shell itself (splash, status bar, haptics, deep links).

## 3. App Store submission checklist
**Accounts & identifiers**
- [ ] Apple Developer Program membership (US$99/year) — developer.apple.com/programs
- [ ] Note your 10-character **Team ID** (developer.apple.com → Membership)
- [ ] Put it in `public/.well-known/apple-app-site-association`: replace `TEAMID` → your Team ID, then deploy. This makes invite links (https://…/join/…) open in the app.
- [ ] In Xcode → App target → Signing & Capabilities: choose your Team (automatic signing); the *Associated Domains* capability is already declared in `App.entitlements`.
- [ ] App Store Connect → New App: name **Splitr Pro**, bundle ID `com.splitfree.app`, SKU any, primary language English.

**Build & upload**
- [ ] Bump version: Xcode → General → Version (e.g. 1.0) and Build (increase for every upload)
- [ ] Product → Archive → Distribute App → App Store Connect → Upload
- [ ] TestFlight: test on a real iPhone first (haptics, UPI apps, WhatsApp, deep links, push is not in v1)

**Store listing** (App Store Connect)
- [ ] Screenshots: 6.9" iPhone (1320×2868) required; 6.5"/6.1" optional
- [ ] Description, keywords, support URL `https://splitfree-xi.vercel.app/support`, privacy URL `https://splitfree-xi.vercel.app/privacy`
- [ ] Category: Finance (or Lifestyle). Price: Free. Age rating: answer the questionnaire (no objectionable content → 4+)
- [ ] **App Privacy** (nutrition label): data linked to the user — Email address, Name, User content (expenses/groups/comments), Contact info of friends they add (name/email); used for App Functionality; **not** used for tracking; no third-party advertising.
- [ ] Export compliance: already answered in Info.plist (`ITSAppUsesNonExemptEncryption = false`, only standard HTTPS)
- [ ] **Review notes: provide a working test account** (email + password with sample data). The demo login was removed, so create one (e.g. appreview@yourdomain) and put the credentials in *App Review Information*.

### App Store Connect → App Privacy (answer these exactly; they must match the privacy policy)
The app collects the data below. For **every** item choose: *linked to the user* = **Yes**, *used for tracking* = **No**, purpose = **App Functionality** (and nothing else — no advertising, no analytics purpose unless you add an analytics tool).
| Category | Data type | Why |
|---|---|---|
| Contact Info | **Name** | shown to friends in groups |
| Contact Info | **Email Address** | sign-in, invites |
| Contact Info | **Phone Number** | **required at sign-up** (kept private, not verified, no SMS sent) |
| User Content | **Other User Content** | expenses, groups, comments |
| Financial Info | **Other Financial Info** | amounts owed/paid and your optional UPI ID |
| Identifiers | **User ID** | your account |
| Usage Data | **Product Interaction** | only if you keep the usage note in the privacy policy |
Privacy Policy URL: `https://splitfree-xi.vercel.app/privacy` (updated 5 Oct 2026 to mention the mobile number). If you ever add SMS/OTP or an analytics tool, update both the policy and these answers first.

## 4. What reviewers look at (be ready)
- **4.2 Minimum functionality** — an app that is only a website can be rejected. This app adds native behaviour: status bar and launch handling, haptics on money actions, deep links from invites, UPI app hand-off, a bundled offline screen. For extra safety add before submitting (each is small): push notifications (APNs), Face ID lock, native share sheet for invites, Home Screen quick actions.
- **4.8 Sign in with Apple** — required when an app offers *other* third-party sign-in (Google). The iPhone app offers **email sign-in only**, so it isn't triggered. If you later enable Google/Facebook in the iPhone app, add Sign in with Apple too.
- **5.1.1(v) Account deletion** — present (Settings → Delete account) and works in-app.
- **5.1.1 Privacy** — policy URL present; data export present (Settings → Download my data).
- **Payments** — the app records who owes whom and opens UPI/other apps; it does not process payments itself, so In-App Purchase rules don't apply.

## 5. Known limits of v1
- **Push notifications:** Web Push doesn't work inside WKWebView. In-app/email notifications still work. Native push needs `@capacitor/push-notifications`, an APNs key, and server-side sending — a good v1.1.
- **Offline:** data you've seen and writes made offline work (stored on device, synced later). The site itself must load once per launch; with no network at launch the bundled offline screen appears. (Service workers would need `WKAppBoundDomains` — test that in the Simulator before enabling.)
- **Google sign-in** is hidden in the iPhone app (Google blocks embedded browsers). Native Google/Apple sign-in can be added with a Capacitor social-login plugin.
- **Saving files:** the app's web view can't download files, so *Export CSV*, *Download my data* and the invite QR open the iOS share sheet (Save to Files, AirDrop, WhatsApp) — see `src/lib/save-file.ts`. PDF export (needs a print dialog) is not offered on phones.
- iPad: not targeted (iPhone only) — set `TARGETED_DEVICE_FAMILY` to `1,2` and add iPad screenshots to support it.

## 6. After you change the config or icons
```
npm run ios:assets    # regenerates the App Store icon (1024, no transparency) and launch image from the brand mark
npm run ios:sync      # copies config/plugins into the Xcode project
```

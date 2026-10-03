import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app is a native shell (WKWebView) around the live site, so web releases reach iPhone users without an
 * App Store review each time. Native pieces (status bar, splash, keyboard, haptics, deep links, external links) come
 * from Capacitor plugins; see ios/README.md for the App Store checklist.
 *
 * Point the shell at another server for testing:  CAP_SERVER_URL=http://localhost:3000 npx cap sync ios
 */
const base = process.env.CAP_SERVER_URL ?? "https://splitfree-xi.vercel.app";
// The app opens on the dashboard (signed-out people are sent to sign-in), never the marketing page
const url = new URL("/dashboard", base).href;

const config: CapacitorConfig = {
  appId: "com.splitfree.app",
  appName: "Splitr Pro",
  // Capacitor needs a web directory; the app itself loads from `server.url`
  webDir: "ios-web",
  server: {
    url,
    cleartext: url.startsWith("http://"), // only for local testing against `next dev` / `next start`
    // Links to other sites open in Safari (see NativeBridge); these hosts stay inside the app
    allowNavigation: [new URL(url).host],
    errorPath: "offline.html", // shown (bundled, no network needed) if the site can't be reached at launch
  },
  ios: {
    contentInset: "never", // the web app handles safe areas itself (viewport-fit=cover + env(safe-area-inset-*))
    backgroundColor: "#6d28d9",
    scheme: "SplitrPro",
    limitsNavigationsToAppBoundDomains: false,
    allowsLinkPreview: false,
    appendUserAgent: "SplitrProApp/1.0", // lets the web app (and server logs) recognise the iPhone app
  },
  plugins: {
    SplashScreen: {
      // NativeBridge hides it as soon as the page is ready; this timer is the safety net, so the launch image can
      // never get stuck on screen (offline at launch, slow network, page error)
      launchShowDuration: 8000,
      launchAutoHide: true,
      backgroundColor: "#6d28d9",
      showSpinner: false,
    },
    // "body": the page shrinks above the keyboard (no black gap behind it, fields stay visible)
    Keyboard: { resize: "body", resizeOnFullScreen: true },
    StatusBar: { style: "DARK", overlaysWebView: true },
  },
};

export default config;

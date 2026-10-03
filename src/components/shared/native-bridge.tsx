"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { deepLinkToPath, hasBrandHeader, isNativeApp, nativePlatform } from "@/lib/native";

/**
 * Glue between the web app and the iPhone shell. Does nothing in a normal browser.
 *  - marks <html> (data-native) so CSS can adapt;
 *  - keeps the status-bar text colour right for the page behind it (white on the purple sign-in header);
 *  - hides the launch image once the page is ready (not before: no blank flash);
 *  - opens invite / universal links inside the app.
 */
export function NativeBridge() {
  const pathname = usePathname();
  const router = useRouter();

  // One-time setup
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.dataset.native = nativePlatform();
    root.classList.add("native-app");

    SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});

    const appHost = window.location.host;
    const handle = App.addListener("appUrlOpen", ({ url }) => {
      const path = deepLinkToPath(url, appHost);
      if (path) router.push(path);
    });
    return () => { handle.then((h) => h.remove()).catch(() => {}); };
  }, [router]);

  // Status bar text colour follows the screen
  useEffect(() => {
    if (!isNativeApp()) return;
    StatusBar.setStyle({ style: hasBrandHeader(pathname) ? Style.Dark : Style.Default }).catch(() => {});
  }, [pathname]);

  return null;
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/app-config";
import { iosStartupImages } from "@/lib/ios-splash";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { QueryProvider } from "@/components/shared/query-provider";
import { MotionProvider } from "@/components/shared/motion-provider";
import { ServiceWorkerRegistration } from "@/components/shared/sw-register";
import { NativeBridge } from "@/components/shared/native-bridge";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // only the small ⌘K hint uses it — don't make it compete with the main font for bandwidth
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ["expense splitting", "splitwise alternative", "group expenses", "split bills"],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/icons/icon-192x192.png",
  },
  openGraph: {
    type: "website",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  // iPhone home-screen app: full-screen, own title, and a launch image instead of a blank white flash
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default", startupImage: iosStartupImages() },
  // Don't let iOS turn amounts like "1,200.00" into phone-number links
  formatDetection: { telephone: false, email: false, address: false },
  other: {
    // Next emits the newer mobile-web-app-capable; older iOS versions still look for the Apple-prefixed one
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
    "application-name": APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / home bar (the app pads with safe-area insets). Pinch-zoom stays ON for accessibility:
  // inputs are 16px on touch devices (globals.css), which is what stops iOS zooming when a field is focused.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-background font-sans antialiased">
        {/* Inline SW registration so crawlers (PWABuilder, Lighthouse) detect it */}
        <script
          dangerouslySetInnerHTML={{
            // (also tags the iPhone app before first paint so web-only bits, e.g. the Google button, never flash)
            __html: `if(/SplitrProApp/.test(navigator.userAgent))document.documentElement.classList.add('native-app');if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <ServiceWorkerRegistration />
            <NativeBridge />
            <MotionProvider>{children}</MotionProvider>
            <Toaster
              position="bottom-right"
              richColors
              closeButton
              theme="system"
              toastOptions={{
                classNames: {
                  toast: "font-sans text-sm",
                },
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

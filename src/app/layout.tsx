import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { QueryProvider } from "@/components/shared/query-provider";
import { ServiceWorkerRegistration } from "@/components/shared/sw-register";
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
});

export const metadata: Metadata = {
  title: {
    default: "SplitFree — Split expenses, not friendships",
    template: "%s | SplitFree",
  },
  description:
    "The free, beautiful alternative to Splitwise. Split expenses with friends and groups effortlessly.",
  keywords: ["expense splitting", "splitwise alternative", "group expenses", "split bills"],
  authors: [{ name: "SplitFree" }],
  creator: "SplitFree",
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
    title: "SplitFree",
    description: "The free, beautiful alternative to Splitwise.",
    siteName: "SplitFree",
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitFree",
    description: "The free, beautiful alternative to Splitwise.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <ServiceWorkerRegistration />
            {children}
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

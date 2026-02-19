import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "@/components/providers/toaster";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { OfflineIndicator } from "@/components/error/offline-indicator";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { RouteChrome } from "@/components/layout/route-chrome";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true, // Preload critical font
  adjustFontFallback: true, // Better font fallback
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Secondary font, don't preload
  adjustFontFallback: true,
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Monospace font, don't preload
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Finance Dojo",
  description: "Financial Education Platform",
  icons: {
    icon: "/fav-fd.ico",
    shortcut: "/fav-fd.ico",
    apple: "/fav-fd.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr-CA" className={`${plusJakartaSans.variable} ${sourceSerif4.variable} ${jetBrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/fav-fd.ico" sizes="any" />
        {/* Resource hints for external domains - improves connection speed */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://player.vimeo.com" />
        <link rel="dns-prefetch" href="https://player.vimeo.com" />
        {/* Stripe preconnect hints */}
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="preconnect" href="https://m.stripe.network" />
        <link rel="preconnect" href="https://m.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://m.stripe.com" />
        <link rel="dns-prefetch" href="https://m.stripe.network" />

        {/* Blocking script to prevent theme flash - runs before page renders */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const storageKey = 'dojo-theme';
                const theme = localStorage.getItem(storageKey) || 'light';
                const root = document.documentElement;
                root.classList.remove('light', 'dark');
                if (theme === 'system') {
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  root.classList.add(systemTheme);
                } else {
                  root.classList.add(theme);
                }
              })();
            `,
          }}
        />
        {/* Blocking script to prevent navigation flash - sets brutalist chrome before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var p = window.location.pathname;
                if (
                  p === '/' ||
                  p === '/contact' ||
                  p.indexOf('/courses') === 0 ||
                  p.indexOf('/formations') === 0 ||
                  (p.indexOf('/investor') === 0 && p.indexOf('/waitlist') === -1) ||
                  (p.indexOf('/cohorts') === 0 && p.indexOf('/learn') === -1) ||
                  (p.indexOf('/cohorte') === 0 && p.indexOf('/learn') === -1)
                ) {
                  document.documentElement.dataset.chrome = 'brutalist';
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <ThemeProvider defaultTheme="light" storageKey="dojo-theme">
          <QueryProvider>
            <ErrorBoundary>
              <Suspense fallback={null}>
                <RouteChrome />
              </Suspense>
              <div className="flex min-h-screen flex-col">
                <Suspense fallback={
                  <nav className="border-b overflow-hidden">
                    <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-4 max-w-full">
                      <div className="flex items-center gap-2 sm:gap-8 min-w-0 flex-shrink">
                        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
                        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </nav>
                }>
                  <Navbar />
                </Suspense>
                <main className="flex-1">
                  {children}
                </main>
                <Suspense fallback={
                  <footer className="border-t bg-muted/40 py-6">
                    <div className="container mx-auto px-4">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </footer>
                }>
                  <Footer />
                </Suspense>
              </div>
              <OfflineIndicator />
            </ErrorBoundary>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


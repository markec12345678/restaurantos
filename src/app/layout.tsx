import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { RegisterSW } from "@/components/register-sw";
import { ErrorHandler } from "@/components/error-handler";
import { DynamicHtmlLang } from "@/components/DynamicHtmlLang";
import { CookieConsent } from "@/components/pos/legal/CookieConsent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // A11Y FIX (WCAG 1.4.4): odstranjeno userScalable: false + maximumScale: 1
  // Slabovidni uporabniki morajo lahko zoom-a-jo (do 200% ali več).
  // Prejšnja konfiguracija je blokirala zoom — kršitev WCAG 2.1 AA.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f59e0b" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export const metadata: Metadata = {
  title: "RestaurantOS - Prodajna točka",
  description: "Celovit POS sistem za restavracije - naročila, mize, jedilnik, zaloga, HACCP, FURS",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RestaurantOS POS",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="touch-action" content="manipulation" />
        <meta name="installable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground select-none overscroll-none`}
        style={{ overscrollBehavior: 'none', touchAction: 'manipulation' }}
      >
        {/* A11Y FIX (WCAG 2.4.1): skip-to-content link — keyboard uporabniki
            preskočijo sidebar/header in grejo direktno na vsebino */}
        <a href="#main-content" className="skip-to-content">
          Preskoči na vsebino
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {/* A11Y FIX (WCAG 3.1.1): <html lang> se posodobi dinamično
                ob spremembi jezika — DynamicHtmlLang komponenta */}
            <DynamicHtmlLang />
            {children}
            <ErrorHandler />
            <Toaster position="top-right" richColors />
            <RegisterSW />
            <CookieConsent />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

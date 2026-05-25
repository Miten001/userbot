import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap"
});

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PlayHub";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com";
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Free Online HTML5 Games`,
    template: `%s · ${SITE_NAME}`
  },
  description:
    `Play 35+ free HTML5 games on ${SITE_NAME}. Action, puzzle, racing, shooting, .io, sports and more — no downloads, just press play.`,
  keywords: [
    "free online games",
    "html5 games",
    "browser games",
    "play games online",
    "io games",
    "action games",
    "puzzle games",
    SITE_NAME
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: `${SITE_NAME} — Free Online HTML5 Games`,
    description:
      "Hundreds of free browser games. Action, puzzle, racing and more.",
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Free Online HTML5 Games`,
    description: "Hundreds of free browser games. No download required."
  },
  robots: { index: true, follow: true },
  // AdSense ownership verification meta tag (only added when configured)
  other: ADSENSE_CLIENT
    ? { "google-adsense-account": ADSENSE_CLIENT }
    : undefined
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable}`}>
      <head>
        {/* Google AdSense — only loads when client ID is configured */}
        {ADSENSE_CLIENT && (
          <Script
            id="adsense-script"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
        {/* Google Analytics 4 — optional */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

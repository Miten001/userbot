import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ApexFunded — Trade Big. Get Funded.",
  description:
    "ApexFunded is a next-gen forex prop firm. Pass our challenge, trade up to $200,000 in capital, and keep up to 90% of the profits.",
  keywords: [
    "forex prop firm",
    "funded trader",
    "trading challenge",
    "ApexFunded",
    "prop trading",
  ],
  openGraph: {
    title: "ApexFunded — Trade Big. Get Funded.",
    description:
      "Pass the challenge. Trade up to $200K. Keep 90% of profits.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

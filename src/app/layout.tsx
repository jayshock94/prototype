import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";

import "./globals.css";

/**
 * Roboto is Material 3's default typeface. next/font downloads it at build time
 * and serves it from our own domain, so there is no request to Google at run
 * time and no flash of unstyled text. The weights are the ones the M3 type
 * scale actually uses: 400 for body and 500 for labels and titles.
 */
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prototype Review Portal",
  description: "Private prototype review and feedback capture.",
  // This is a private tool. Keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Tells the browser we have designed for both schemes, so form controls and
  // scrollbars match the M3 dark palette instead of staying stubbornly light.
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fef7ff" },
    { media: "(prefers-color-scheme: dark)", color: "#141218" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

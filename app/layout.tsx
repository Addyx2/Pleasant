import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Self-hosted (app/fonts), so builds never depend on Google Fonts answering.
const dmSans = localFont({
  src: "./fonts/dm-sans-latin.woff2",
  variable: "--font-dm",
  display: "swap",
  weight: "100 1000",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-grotesk",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: {
    default: "Pleasant — Shift staffing & payroll for UK healthcare agencies",
    template: "%s · Pleasant",
  },
  description:
    "Pleasant matches workers to shifts, captures approved hours, pays under UK PAYE and bills the client — one loop from request to payment for healthcare staffing agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
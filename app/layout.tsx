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
    default: "Pleasant — Shifts & payroll for healthcare agencies",
    template: "%s · Pleasant",
  },
  description:
    "Pleasant is the shift scheduling, timesheet and UK payroll platform built for healthcare agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${dmSans.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
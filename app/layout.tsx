import type { Metadata } from "next";

import "./globals.css";

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
    <html lang="en-GB">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

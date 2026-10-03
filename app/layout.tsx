import type { Metadata } from "next";

import "./globals.css";

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
    <html lang="en-GB">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
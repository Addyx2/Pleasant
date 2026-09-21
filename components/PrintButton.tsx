"use client";

import { Printer } from "lucide-react";

import { subtleButtonClass } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={subtleButtonClass}>
      <Printer className="h-4 w-4" /> Print / save PDF
    </button>
  );
}

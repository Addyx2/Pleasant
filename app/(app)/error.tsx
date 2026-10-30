"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { buttonClass, subtleButtonClass } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-600/10">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-slate-900">
        This page didn&apos;t load
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Nothing you entered has been lost. Try again — if it keeps happening, send us the reference
        below so we can trace it.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClass}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
        <Link href="/qualifiers" className={subtleButtonClass}>
          Back to Qualifiers
        </Link>
      </div>
    </div>
  );
}

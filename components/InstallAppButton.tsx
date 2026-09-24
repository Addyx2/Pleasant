"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string; platform: string }> } | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as unknown as {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string; platform: string }>;
      };
      setDeferred(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <section className="rounded-3xl bg-brand-600 p-5 text-white shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Pleasant Workers on your phone</h2>
          <p className="mt-1 text-xs text-brand-100">
            Install it as an app for one-tap access to your shifts and sign-off.
          </p>
          {deferred && !installed ? (
            <button
              type="button"
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 active:scale-[0.99]"
            >
              <Download className="h-4 w-4" />
              Install the app
            </button>
          ) : null}
          {installed ? (
            <p className="mt-3 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
              Installed — find Pleasant Workers on your home screen.
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-brand-100">
            On iPhone: tap the Share button, then &quot;Add to Home Screen&quot;.
          </p>
        </div>
      </div>
    </section>
  );
}
"use client";

import { useEffect } from "react";

/**
 * Next.js serves a single global manifest from app/manifest.ts. To give the
 * Pleasant Workers app its own install identity ("Pleasant Workers" on the
 * home screen), we inject a route-scoped manifest link into <head> while the
 * /workforce shell is mounted. It is appended after the global manifest, so
 * browsers use it as the last manifest on the page.
 */
export function WorkersPwaTags() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.workers.json";
    link.dataset.workerPwa = "1";
    document.head.appendChild(link);
    return () => {
      document.querySelector('link[data-worker-pwa="1"]')?.remove();
    };
  }, []);

  return null;
}
import { headers } from "next/headers";

/** Where Pleasant lives when nothing else says: production, or the local dev server. */
export function defaultOrigin(): string {
  return process.env.NODE_ENV === "production" ? "https://pleasant.aultrum.co.uk" : "http://localhost:3000";
}

/**
 * Absolute URL for links that leave the app (emails, copy-to-clipboard invites).
 * APP_URL if set; otherwise the host of the request being served; otherwise,
 * for work done outside a request (Pushbots' emails to the office, scheduled
 * runs), the default address, so a link in an email is never a bare path.
 */
export async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}${path}`;
  // Outside a request, headers() throws before it returns a promise.
  let h: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    h = await headers();
  } catch {
    h = null;
  }
  const host = h?.get("x-forwarded-host") ?? h?.get("host");
  if (!host) return `${defaultOrigin()}${path}`;
  const proto = h?.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}${path}`;
}

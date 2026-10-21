import { headers } from "next/headers";

/** Absolute URL for links that leave the app (emails, copy-to-clipboard invites). */
export async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}${path}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}${path}`;
}

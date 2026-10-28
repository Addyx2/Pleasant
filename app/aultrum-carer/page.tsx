import { redirect } from "next/navigation";

import { carerAppUrl } from "@/lib/aultrum-id";

export const dynamic = "force-dynamic";

// After a carer adds Pleasant to the Aultrum carer app (signing in here with
// Aultrum ID once), this sends them back to it. A page rather than a route
// handler, so the browser follows it after the link form, not the server.
export default function BackToCarerApp() {
  redirect(`${carerAppUrl()}/?added=pleasant`);
}

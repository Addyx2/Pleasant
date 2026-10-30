import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isOpsRole } from "@/lib/permissions";

// pleasant.aultrum.co.uk is the app itself: the product's marketing pages
// live on the Aultrum site (aultrum.co.uk/pleasant). Visitors go straight to
// sign-in; signed-in users go to their home in the app.
export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(isOpsRole(user.role) ? "/qualifiers" : "/workforce");
}

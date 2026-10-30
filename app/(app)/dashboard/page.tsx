import { redirect } from "next/navigation";

export const metadata = { title: "Qualifiers" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  redirect("/qualifiers");
}

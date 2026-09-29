import { redirect } from "next/navigation";

export const metadata = { title: "Oversight" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  redirect("/oversight");
}
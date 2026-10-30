import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pushbot office conversation" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** An office member's texts with the Pushbot, read-only: everyone in the office can see what was asked and done. */
export default async function OfficeConversationPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireOps();
  const { userId } = await params;
  const member = await prisma.user.findFirst({ where: { id: userId, agencyId: user.agencyId }, select: { firstName: true, lastName: true } });
  if (!member) notFound();
  const texts = await prisma.smsMessage.findMany({ where: { agencyId: user.agencyId, userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <Link href="/persona/pushbots/messages" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All texts
      </Link>
      <h2 className="font-display text-lg font-bold text-slate-900">{member.firstName} {member.lastName} <span className="text-sm font-normal text-slate-500">· office</span></h2>
      <Card className="space-y-2 p-4">
        {texts.length === 0 ? <p className="text-sm text-slate-500">No texts yet.</p> : null}
        {[...texts].reverse().map((t) => (
          <div key={t.id} className={cn("flex", t.direction === "IN" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", t.direction === "IN" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900", t.status === "FAILED" && "bg-red-100 text-red-800")}>
              <p className="whitespace-pre-wrap">{t.body}</p>
              <p className={cn("mt-1 text-[10px]", t.direction === "IN" ? "text-white/70" : "text-slate-400")}>{fmt.format(t.createdAt)}{t.status === "FAILED" ? " · not sent" : ""}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

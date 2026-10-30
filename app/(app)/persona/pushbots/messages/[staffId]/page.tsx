import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, buttonClass, inputClass } from "@/components/ui";
import { cn } from "@/lib/utils";

import { replyAction } from "../../actions";

export const metadata = { title: "Pushbots conversation" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ staffId: string }>; searchParams: Promise<{ error?: string; sent?: string }> }) {
  const user = await requireOps();
  const { staffId } = await params;
  const { error, sent } = await searchParams;
  const staff = await prisma.staffProfile.findFirst({ where: { id: staffId, agencyId: user.agencyId }, select: { id: true, firstName: true, lastName: true, phone: true, smsOptOutAt: true } });
  if (!staff) notFound();
  const texts = await prisma.smsMessage.findMany({ where: { agencyId: user.agencyId, staffId }, orderBy: { createdAt: "desc" }, take: 100 });
  const notes = await prisma.agentLog.findMany({
    where: { agencyId: user.agencyId, agentName: "PUSHBOTS", action: "CARER_MESSAGE", details: { contains: staffId } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-4">
      <Link href="/persona/pushbots/messages" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All texts
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold text-slate-900">
          <Link href={`/staff/${staff.id}`} className="hover:text-brand-700">{staff.firstName} {staff.lastName}</Link>
        </h2>
        <span className="text-sm text-slate-500">{staff.phone ?? "no mobile on file"}</span>
        {staff.smsOptOutAt ? <Badge tone="slate">Texted STOP</Badge> : null}
      </div>

      {notes.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Passed to the office</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {notes.map((n) => {
              const d = (() => {
                try {
                  return JSON.parse(n.details ?? "{}") as { kind?: string; message?: string };
                } catch {
                  return {};
                }
              })();
              return (
                <li key={n.id}>
                  <span className="text-xs text-amber-700">{fmt.format(n.createdAt)} · {d.kind?.replace(/_/g, " ")}</span> — {d.message}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-2 p-4">
        {texts.length === 0 ? <p className="text-sm text-slate-500">No texts yet.</p> : null}
        {[...texts].reverse().map((t) => (
          <div key={t.id} className={cn("flex", t.direction === "IN" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", t.direction === "IN" ? "bg-slate-100 text-slate-900" : "bg-brand-600 text-white", t.status === "FAILED" && "bg-red-100 text-red-800")}>
              <p className="whitespace-pre-wrap">{t.body}</p>
              <p className={cn("mt-1 text-[10px]", t.direction === "IN" ? "text-slate-400" : "text-white/70")}>
                {fmt.format(t.createdAt)}
                {t.status === "FAILED" ? " · not sent" : ""}
              </p>
            </div>
          </div>
        ))}
      </Card>

      <form action={replyAction} className="space-y-2">
        <input type="hidden" name="staffId" value={staff.id} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        {sent ? <p role="status" className="text-sm text-emerald-700">Sent.</p> : null}
        <label htmlFor="reply" className="text-xs font-medium text-slate-600">Text {staff.firstName} from the office</label>
        <textarea id="reply" name="body" rows={2} maxLength={600} className={inputClass} placeholder={`Hi ${staff.firstName}, …`} disabled={!!staff.smsOptOutAt} />
        <button type="submit" className={buttonClass} disabled={!!staff.smsOptOutAt}>Send text</button>
      </form>
    </div>
  );
}

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { displayPhone } from "@/lib/integrations/phone";
import { sharedSender } from "@/lib/integrations/sms";
import { pushbotsAiAvailable } from "@/lib/pushbots/agent";
import { Badge, Card, buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";

import { retryNumberAction, savePushbotAction, setOfficeMobileAction } from "../actions";

export const metadata = { title: "Pushbot settings" };
export const dynamic = "force-dynamic";

export default async function PushbotSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireOps();
  const { saved, error } = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const [pushbot, office] = await Promise.all([
    prisma.pushbot.findUnique({ where: { agencyId: user.agencyId } }),
    prisma.user.findMany({
      where: { agencyId: user.agencyId, role: { in: ["ADMIN", "MANAGER"] }, deactivatedAt: null },
      select: { id: true, firstName: true, lastName: true, role: true, mobile: true },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
    }),
  ]);
  const shared = sharedSender();
  const ai = pushbotsAiAvailable();
  const p = pushbot ?? { name: "Pushbot", tone: "friendly", enabled: true, officeTexts: true, waveSize: 5, waveGapMins: 15 };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        {error ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {saved === "new" ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your Pushbot is created. Its number is being set up; refresh in a moment.</p>
        ) : saved ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved.</p>
        ) : null}

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">{pushbot ? "Your Pushbot" : "Create your Pushbot"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your agency&apos;s own texting agent. It offers open shifts to carers, answers their texts as them, and takes jobs from your office by text. It gets a UK mobile number of its own.
          </p>
          <form action={savePushbotAction} className="mt-4 space-y-4">
            <fieldset disabled={!isAdmin} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className={labelClass}>Name</label>
                  <input id="name" name="name" defaultValue={p.name} maxLength={40} className={`mt-1 ${inputClass}`} />
                  <p className="mt-1 text-xs text-slate-500">How it introduces itself, e.g. &ldquo;Bria from Brightwater&rdquo;.</p>
                </div>
                <div>
                  <label htmlFor="tone" className={labelClass}>Tone</label>
                  <select id="tone" name="tone" defaultValue={p.tone} className={`mt-1 ${inputClass}`}>
                    <option value="friendly">Friendly</option>
                    <option value="brief">Brief</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="waveSize" className={labelClass}>Carers asked at a time</label>
                  <input id="waveSize" name="waveSize" type="number" min={1} max={20} defaultValue={p.waveSize} className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label htmlFor="waveGapMins" className={labelClass}>Minutes before asking the next carers</label>
                  <input id="waveGapMins" name="waveGapMins" type="number" min={5} max={240} defaultValue={p.waveGapMins} className={`mt-1 ${inputClass}`} />
                </div>
              </div>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" name="enabled" defaultChecked={p.enabled} className="mt-0.5" />
                <span><span className="font-medium">Text carers.</span> Off: offers still reach carers&apos; apps, but nothing is texted.</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input type="checkbox" name="officeTexts" defaultChecked={p.officeTexts} className="mt-0.5" />
                <span><span className="font-medium">Take jobs from the office by text.</span> Only from the mobiles registered below. Changes wait for a YES code; timesheets, pay, invoices and compliance are never done by text.</span>
              </label>
            </fieldset>
            {isAdmin ? <button type="submit" className={buttonClass}>{pushbot ? "Save" : "Create my Pushbot"}</button> : <p className="text-xs text-slate-500">Only an admin can change these.</p>}
          </form>
        </Card>

        {pushbot ? (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">Office mobiles</h2>
            <p className="mt-1 text-sm text-slate-500">
              Texts from these numbers reach {pushbot.name} as that person, with their permissions in Pleasant. Ask &ldquo;who&apos;s on at Meadow View tonight?&rdquo;, or &ldquo;fill tomorrow&apos;s night at Oakfield&rdquo; and reply YES with the code it sends.
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              {office.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-slate-500">{u.role === "ADMIN" ? "Admin" : "Manager"}</p>
                  </div>
                  <form action={setOfficeMobileAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <input name="mobile" defaultValue={u.mobile ? displayPhone(u.mobile) : ""} placeholder="07700 900123" disabled={!isAdmin} aria-label={`${u.firstName}'s mobile`} className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                    {isAdmin ? <button type="submit" className={subtleButtonClass}>Save</button> : null}
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Its number</h2>
          {!pushbot ? (
            <p className="mt-2 text-sm text-slate-500">Create your Pushbot and it gets a UK mobile number of its own, straight away. You don&apos;t need a Twilio account.</p>
          ) : pushbot.numberStatus === "active" && pushbot.number ? (
            <div className="mt-2">
              <p className="font-display text-2xl font-bold tracking-tight text-slate-900">{displayPhone(pushbot.number)}</p>
              <p className="mt-1 text-sm text-slate-500">Carers and your office text this number. Give it to carers as {pushbot.name}&apos;s number.</p>
              <Badge tone={pushbot.enabled ? "green" : "slate"} className="mt-2">{pushbot.enabled ? "Texting" : "Texting is off"}</Badge>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <Badge tone={pushbot.numberStatus === "failed" ? "amber" : "slate"}>{pushbot.numberStatus === "failed" ? "Couldn't get a number yet" : "Setting up"}</Badge>
              {pushbot.numberError ? <p className="text-slate-600">{pushbot.numberError}</p> : null}
              {shared ? (
                <p className="text-slate-500">Meanwhile it texts from Aultrum&apos;s shared Pushbots number{shared.from.startsWith("+") ? ` (${displayPhone(shared.from)})` : ""}, so nothing waits.</p>
              ) : (
                <p className="text-slate-500">Texting isn&apos;t available on this deployment yet.</p>
              )}
              {isAdmin ? (
                <form action={retryNumberAction}>
                  <button type="submit" className={subtleButtonClass}>Try again</button>
                </form>
              ) : null}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Answering texts</h2>
          <p className="mt-2 text-sm text-slate-500">
            {ai
              ? "On. Carers' and the office's texts are answered by AI, each as the person texting and with only their permissions. Every text and action shows under Texts."
              : "Off: AI isn't set up for this deployment. Offers and YES/NO replies still work."}
          </p>
        </Card>
      </div>
    </div>
  );
}

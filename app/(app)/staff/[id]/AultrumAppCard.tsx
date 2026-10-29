import { Link2 } from "lucide-react";

import { AultrumInvite } from "@/components/AultrumInvite";
import { Card, subtleButtonClass } from "@/components/ui";

import { createAultrumLinkAction, disconnectAultrumAction } from "../actions";

/**
 * The carer's Aultrum app: an Aultrum Link to send them (like a server
 * invite), or their connection once they've joined.
 */
export function AultrumAppCard({ staffId, firstName, connected }: { staffId: string; firstName: string; connected: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Link2 className="h-4 w-4 text-brand-600" /> Aultrum app</h2>
          <p className="mt-1 text-xs text-slate-500">
            {connected
              ? `${firstName} has joined you in the Aultrum app: they see their shifts, offers, Pool and checks there.`
              : `Send ${firstName} an Aultrum Link. They open it (or type its code) in the Aultrum app and you appear there, with their shifts. No Pleasant login needed.`}
          </p>
        </div>
        {connected ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Connected</span> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <AultrumInvite create={createAultrumLinkAction.bind(null, staffId)} label={connected ? "Send a new link" : "Create Aultrum Link"} message="Join us on the Aultrum app to see your shifts" />
        {connected ? (
          <form action={disconnectAultrumAction}>
            <input type="hidden" name="staffId" value={staffId} />
            <button type="submit" className={subtleButtonClass}>Disconnect</button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

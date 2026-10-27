import { ElementScreen } from "@/components/ElementScreen";
import { requireInstalledAddon } from "@/lib/addons-guard";

export const metadata = { title: "Gateway" };
export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const { user, installationId } = await requireInstalledAddon("GATEWAY");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">Gateway</h1>
        <p className="mt-1.5 text-sm text-slate-500">Calls, texts and web chat answered for your agency. Conversations that need a person come first.</p>
      </div>
      <ElementScreen installationId={installationId} title="Gateway inbox" user={{ id: user.id, name: `${user.firstName} ${user.lastName}`, role: "manager" }} />
    </div>
  );
}

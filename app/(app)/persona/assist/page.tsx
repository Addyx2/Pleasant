import { AssistWorkspace } from "@/components/assist/AssistWorkspace";
import { listConversations } from "@/lib/assist/store";
import { requireOps } from "@/lib/auth";

export const metadata = { title: "Assist" };
export const dynamic = "force-dynamic";

export default async function AssistPage() {
  const user = await requireOps();
  const conversations = await listConversations(user);
  return <AssistWorkspace initial={null} conversations={conversations} role={user.role} firstName={user.firstName} />;
}

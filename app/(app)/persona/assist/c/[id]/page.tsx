import { notFound } from "next/navigation";

import { AssistWorkspace } from "@/components/assist/AssistWorkspace";
import { conversationView, listConversations } from "@/lib/assist/store";
import { requireOps } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOps();
  const view = await conversationView(user, (await params).id);
  return { title: view ? `${view.title} · Assist` : "Assist" };
}

export default async function AssistConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOps();
  const { id } = await params;
  const [view, conversations] = await Promise.all([conversationView(user, id), listConversations(user)]);
  if (!view) notFound();
  return (
    <AssistWorkspace
      key={view.id}
      initial={view}
      conversations={conversations}
      role={user.role}
      firstName={user.firstName}
    />
  );
}

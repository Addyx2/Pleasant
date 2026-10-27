import { z } from "zod";

import { conversationView, ownedConversation } from "@/lib/assist/store";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpsRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function signedIn() {
  const user = await getSessionUser();
  return user && isOpsRole(user.role) ? user : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await signedIn();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const view = await conversationView(user, (await params).id);
  return view ? Response.json(view) : Response.json({ error: "Not found" }, { status: 404 });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await signedIn();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Expected JSON" }, { status: 415 });
  }
  const conversation = await ownedConversation(user, (await params).id);
  if (!conversation) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  // updatedAt is left alone so pinning or renaming doesn't reorder history.
  await prisma.assistConversation.update({
    where: { id: conversation.id },
    data: { ...parsed.data, updatedAt: conversation.updatedAt },
  });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await signedIn();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { count } = await prisma.assistConversation.deleteMany({ where: { id: (await params).id, userId: user.id } });
  return count ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}

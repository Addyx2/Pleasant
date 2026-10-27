import { listConversations } from "@/lib/assist/store";
import { getSessionUser } from "@/lib/auth";
import { isOpsRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !isOpsRole(user.role)) return Response.json({ error: "Not signed in" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 100) ?? undefined;
  return Response.json({ conversations: await listConversations(user, { query }) });
}

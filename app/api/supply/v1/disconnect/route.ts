import { prisma } from "@/lib/db";
import { json, supplyFromRequest, unauthorised } from "@/lib/supply-api";

export const dynamic = "force-dynamic";

/** POST /api/supply/v1/disconnect: the client removed this agency from Workspace Supply. */
export async function POST(request: Request) {
  const supply = await supplyFromRequest(request);
  if (!supply) return unauthorised();
  await prisma.client.update({ where: { id: supply.clientId }, data: { aultrumBuyerId: null, aultrumBuyerName: null } });
  return json({ ok: true });
}

import { prisma } from "@/lib/db";
import { json, supplyClaims, unauthorised } from "@/lib/supply-api";

export const dynamic = "force-dynamic";

/** POST /api/supply/v1/connect: a client accepted the Aultrum Link this agency made, from their Workspace organisation. */
export async function POST(request: Request) {
  const claims = await supplyClaims(request);
  if (!claims) return unauthorised();
  const client = await prisma.client.findFirst({ where: { id: claims.ref, agencyId: claims.org }, select: { id: true, aultrumBuyerId: true, status: true } });
  if (!client) return json({ ok: false, error: "This agency no longer has you as a client. Ask them for a new link." }, 422);
  if (client.aultrumBuyerId && client.aultrumBuyerId !== claims.buyer) {
    return json({ ok: false, error: "Another Workspace organisation is already connected to this agency for you. Ask the agency to disconnect it first." }, 422);
  }
  await prisma.client.update({ where: { id: client.id }, data: { aultrumBuyerId: claims.buyer, aultrumBuyerName: claims.buyerName } });
  return json({ ok: true });
}

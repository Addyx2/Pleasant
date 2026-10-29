import { verifySupplyToken } from "@/lib/aultrum-id";
import { prisma } from "@/lib/db";

// Supply API v1: what Aultrum Workspace calls so a client's team can request
// staff, sign timesheets and see invoices there. Every request carries a token
// Aultrum ID signed for the person, the agency, this client record and their
// Workspace organisation, which must be the one connected to the client.

export function supplyClaims(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? verifySupplyToken(auth.slice(7)) : null;
}

export async function supplyFromRequest(request: Request) {
  const claims = await supplyClaims(request);
  if (!claims) return null;
  const client = await prisma.client.findFirst({
    where: { id: claims.ref, agencyId: claims.org, aultrumBuyerId: claims.buyer },
    select: { id: true, agencyId: true },
  });
  return client ? { ...claims, clientId: client.id, agencyId: client.agencyId } : null;
}

const noStore = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });
export const unauthorised = () => json({ error: "This organisation isn't connected to Supply here" }, 401);

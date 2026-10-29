import { verifyCarerToken } from "@/lib/aultrum-id";
import { prisma } from "@/lib/db";

import type { Carer } from "./screens";

// Carer API v1: what the Aultrum carer app (carer.aultrum.co.uk) calls to show
// a carer their work here. Every request carries a token Aultrum ID signed
// for the person and the agency; the person must have linked their Aultrum ID
// to a carer login in that agency.

export async function carerFromRequest(request: Request): Promise<Carer | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const claims = await verifyCarerToken(auth.slice(7));
  if (!claims) return null;
  const user = await prisma.user.findFirst({
    where: { aultrumSub: claims.sub, agencyId: claims.org, role: "STAFF", deactivatedAt: null },
    include: { staff: { select: { id: true } } },
  });
  if (!user?.staff) return null;
  return { agencyId: user.agencyId, staffId: user.staff.id, userId: user.id };
}

const noStore = { "Cache-Control": "no-store" };

export const unauthorised = () => Response.json({ error: "Not signed in to this organisation" }, { status: 401, headers: noStore });

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

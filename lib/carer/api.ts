import { verifyCarerToken } from "@/lib/aultrum-id";
import { prisma } from "@/lib/db";

import type { Carer } from "./screens";

// Carer API v1: what the Aultrum app (carer.aultrum.co.uk) calls to show a
// carer their work here. Every request carries a token Aultrum ID signed for
// the person and the agency. The person is a carer here once they've joined
// with an Aultrum Link the agency made for them, or (from before Aultrum
// Links) linked their Aultrum ID to their carer login.

export async function carerClaims(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? verifyCarerToken(auth.slice(7)) : null;
}

export async function carerFromRequest(request: Request): Promise<Carer | null> {
  const claims = await carerClaims(request);
  if (!claims) return null;
  const staff = await prisma.staffProfile.findFirst({
    where: { aultrumSub: claims.sub, agencyId: claims.org, status: { not: "INACTIVE" } },
    select: { id: true, agencyId: true, userId: true },
  });
  if (staff) return { agencyId: staff.agencyId, staffId: staff.id, userId: staff.userId ?? `staff:${staff.id}` };
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

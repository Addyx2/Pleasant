import { carerClaims, json, unauthorised } from "@/lib/carer/api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/carer/v1/connect: a carer accepted an Aultrum Link this agency
 * made for them. The token names the carer record (ref) the link was for.
 */
export async function POST(request: Request) {
  const claims = await carerClaims(request);
  if (!claims?.ref) return unauthorised();
  const staff = await prisma.staffProfile.findFirst({
    where: { id: claims.ref, agencyId: claims.org },
    select: { id: true, aultrumSub: true, status: true },
  });
  if (!staff || staff.status === "INACTIVE") return json({ ok: false, error: "This agency no longer has you as a carer. Ask them for a new link." }, 422);
  if (staff.aultrumSub && staff.aultrumSub !== claims.sub) {
    return json({ ok: false, error: "Another Aultrum account is already connected to you at this agency. Ask them to disconnect it, then send a new link." }, 422);
  }
  await prisma.staffProfile.update({ where: { id: staff.id }, data: { aultrumSub: claims.sub } });
  return json({ ok: true });
}

import { revalidatePath } from "next/cache";

import { requestStaff, signOffAsClient, type SupplyResult } from "@/lib/supply";
import { json, supplyFromRequest, unauthorised } from "@/lib/supply-api";

export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** POST /api/supply/v1/actions with {action, ...}: request_staff or sign_timesheet. */
export async function POST(request: Request) {
  const supply = await supplyFromRequest(request);
  if (!supply) return unauthorised();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ ok: false, error: "Body must be JSON with an action" }, 400);

  let result: SupplyResult;
  switch (body.action) {
    case "request_staff": {
      const startAt = new Date(str(body.startAt));
      const endAt = new Date(str(body.endAt));
      const role = str(body.role).slice(0, 80);
      if (!role || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return json({ ok: false, error: "Choose a role, a start and an end" }, 422);
      result = await requestStaff(supply.agencyId, supply.clientId, {
        role,
        startAt,
        endAt,
        count: typeof body.count === "number" ? body.count : 1,
        notes: str(body.notes).slice(0, 500) || null,
        requestedBy: supply.name,
      });
      break;
    }
    case "sign_timesheet":
      // The signer is who Aultrum ID says they are, never a name from the request body.
      if (!supply.name || !supply.position) return json({ ok: false, error: "Add your job title in Workspace before signing timesheets." }, 422);
      result = await signOffAsClient(supply.agencyId, supply.clientId, str(body.timesheetId), {
        name: supply.name,
        position: supply.position,
        evidence: `AULTRUM_WORKSPACE:${supply.sub}`,
      });
      break;
    default:
      return json({ ok: false, error: "Unknown action" }, 400);
  }
  for (const path of ["/shifts", "/timesheets", "/dispatch", "/dashboard", "/oversight"]) revalidatePath(path);
  return json(result, result.ok ? 200 : 422);
}

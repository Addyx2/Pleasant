import { supplyOverview } from "@/lib/supply";
import { json, supplyFromRequest, unauthorised } from "@/lib/supply-api";

export const dynamic = "force-dynamic";

/** GET /api/supply/v1/overview: on site today, timesheets to sign, the next two weeks, rates' roles and invoices. */
export async function GET(request: Request) {
  const supply = await supplyFromRequest(request);
  if (!supply) return unauthorised();
  return json(await supplyOverview(supply.agencyId, supply.clientId));
}

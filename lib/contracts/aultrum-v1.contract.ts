import assert from "node:assert/strict";
import { after, test } from "node:test";

import type { z } from "zod";

import { GET as carerScreen } from "@/app/api/carer/v1/[screen]/route";
import { GET as supplyOverviewRoute } from "@/app/api/supply/v1/overview/route";
import { calendarScreen, homeScreen, passportScreen, peakScreen, poolScreen, timesheetsScreen, type Carer } from "@/lib/carer/screens";
import { prisma } from "@/lib/db";
import { supplyOverview, supplyTimesheets } from "@/lib/supply";

import * as contract from "./aultrum-v1";

// Carer API v1 and Supply API v1 against the contract Aultrum ID reads them
// by (aultrum-v1.ts). Runs on the seeded database: `npm run db:seed` first.

/** What a value becomes on the wire: dates turn into ISO strings. */
type Json<T> = T extends Date ? string : T extends (infer U)[] ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;

// The compiler checks every screen still fits the contract (run by `npm run typecheck`).
type Fits<S extends z.ZodTypeAny, F extends (...args: never[]) => Promise<unknown>> = Json<Awaited<ReturnType<F>>> extends z.input<S> ? true : never;
const fits: [
  Fits<typeof contract.homeScreen, typeof homeScreen>,
  Fits<typeof contract.poolScreen, typeof poolScreen>,
  Fits<typeof contract.calendarScreen, typeof calendarScreen>,
  Fits<typeof contract.passportScreen, typeof passportScreen>,
  Fits<typeof contract.peakScreen, typeof peakScreen>,
  Fits<typeof contract.timesheetsScreen, typeof timesheetsScreen>,
  Fits<typeof contract.supplyOverview, typeof supplyOverview>,
  Fits<typeof contract.supplyTimesheets, typeof supplyTimesheets>,
] = [true, true, true, true, true, true, true, true];
void fits;

const wire = (value: unknown) => JSON.parse(JSON.stringify(value));

function conforms(schema: z.ZodTypeAny, value: unknown, what: string) {
  const parsed = schema.safeParse(wire(value));
  assert.ok(parsed.success, `${what} breaks the contract: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 5))}`);
}

after(() => prisma.$disconnect());

test("Carer API v1: every screen fits the contract, for the busiest seeded carer", async () => {
  const busiest = await prisma.shift.groupBy({ by: ["staffId"], where: { staffId: { not: null } }, _count: true, orderBy: { _count: { staffId: "desc" } }, take: 1 });
  const staff = busiest[0]?.staffId ? await prisma.staffProfile.findUnique({ where: { id: busiest[0].staffId } }) : null;
  assert.ok(staff, "the seed has no carer with shifts");
  const carer: Carer = { agencyId: staff.agencyId, staffId: staff.id, userId: staff.userId ?? `staff:${staff.id}` };

  conforms(contract.homeScreen, await homeScreen(carer), "home");
  conforms(contract.poolScreen, await poolScreen(carer), "pool");
  conforms(contract.calendarScreen, await calendarScreen(carer, null), "calendar");
  conforms(contract.passportScreen, await passportScreen(carer), "passport");
  conforms(contract.peakScreen, await peakScreen(carer), "peak");
  const timesheets = await timesheetsScreen(carer);
  assert.ok(timesheets.timesheets.length > 0, "the seeded carer has timesheets to check");
  conforms(contract.timesheetsScreen, timesheets, "timesheets");
});

test("Supply API v1: the overview and timesheets fit the contract, for every seeded client", async () => {
  const clients = await prisma.client.findMany({ select: { id: true, agencyId: true } });
  assert.ok(clients.length > 0, "the seed has no clients");
  let signed = 0;
  for (const c of clients) {
    conforms(contract.supplyOverview, await supplyOverview(c.agencyId, c.id), `overview for ${c.id}`);
    const timesheets = await supplyTimesheets(c.agencyId, c.id);
    conforms(contract.supplyTimesheets, timesheets, `timesheets for ${c.id}`);
    signed += timesheets.timesheets.filter((t) => t.signed).length;
  }
  assert.ok(signed > 0, "the seed has signed-off timesheets to check");
});

test("Both APIs refuse a request without a token, with an error Aultrum ID can show", async () => {
  const carer = await carerScreen(new Request("http://pleasant.test/api/carer/v1/home"), { params: Promise.resolve({ screen: "home" }) });
  assert.equal(carer.status, 401);
  conforms(contract.actionResult, await carer.json(), "carer 401");
  const supply = await supplyOverviewRoute(new Request("http://pleasant.test/api/supply/v1/overview"));
  assert.equal(supply.status, 401);
  conforms(contract.actionResult, await supply.json(), "supply 401");
});

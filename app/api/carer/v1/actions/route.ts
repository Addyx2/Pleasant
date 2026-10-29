import { revalidatePath } from "next/cache";

import { carerFromRequest, json, unauthorised } from "@/lib/carer/api";
import {
  addUnavailability,
  clockIn,
  clockOut,
  endBreak,
  removeUnavailability,
  requestShift,
  signAsCarer,
  signAsClient,
  startBreak,
  type WorkResult,
} from "@/lib/carer/work";
import { respondToOffer } from "@/lib/offers";

export const dynamic = "force-dynamic";

const REQUEST_MESSAGES = {
  requested: { ok: true, message: "Requested. Your agency will confirm." },
  overlap: { ok: false, error: "You already have a shift that clashes with this one." },
  gone: { ok: false, error: "That shift has just been filled." },
} as const;

const OFFER_MESSAGES = {
  accepted: { ok: true, message: "It's yours. The shift is in your calendar." },
  declined: { ok: true, message: "Declined." },
  overlap: { ok: false, error: "You already have a shift then, so this offer was declined." },
  taken: { ok: false, error: "Someone else took this shift first." },
  gone: { ok: false, error: "This offer has closed." },
} as const;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** POST /api/carer/v1/actions with {action, ...}: something the carer did in the Aultrum carer app. */
export async function POST(request: Request) {
  const carer = await carerFromRequest(request);
  if (!carer) return unauthorised();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return json({ ok: false, error: "Body must be JSON with an action" }, 400);
  const actor = { agencyId: carer.agencyId, ownStaffId: carer.staffId };

  let result: WorkResult;
  switch (body.action) {
    case "clock_in":
      result = await clockIn(actor, str(body.shiftId), { lat: num(body.lat), lng: num(body.lng), accuracy: num(body.accuracy) });
      break;
    case "start_break":
      result = await startBreak(actor, str(body.timesheetId));
      break;
    case "end_break":
      result = await endBreak(actor, str(body.timesheetId));
      break;
    case "clock_out":
      result = await clockOut(actor, str(body.timesheetId));
      break;
    case "sign_carer":
      result = await signAsCarer(actor, { timesheetId: body.timesheetId, signature: body.signature });
      break;
    case "sign_client":
      result = await signAsClient(actor, { timesheetId: body.timesheetId, signature: body.signature, name: body.name, position: body.position });
      break;
    case "request_shift":
      result = REQUEST_MESSAGES[await requestShift(carer.agencyId, carer.staffId, str(body.shiftId), str(body.message))];
      break;
    case "respond_offer":
      result = OFFER_MESSAGES[await respondToOffer({ agencyId: carer.agencyId, staffId: carer.staffId, offerId: str(body.offerId), accept: body.accept === true })];
      break;
    case "add_unavailability":
      result = await addUnavailability(carer.agencyId, carer.staffId, body);
      break;
    case "remove_unavailability":
      result = await removeUnavailability(carer.agencyId, carer.staffId, str(body.id));
      break;
    default:
      return json({ ok: false, error: "Unknown action" }, 400);
  }

  // The office screens and the Workers app show the same shifts.
  for (const path of ["/workforce", "/timesheets", "/shifts", "/dashboard", "/oversight"]) revalidatePath(path);
  return json(result, result.ok ? 200 : 422);
}

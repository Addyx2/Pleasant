import { requestTrial } from "@/lib/pushbots/trial";

export const dynamic = "force-dynamic";

// The "Request a text from our Pushbot" form on aultrum.co.uk/pleasant.
// Called from the page with fetch (JSON back), or as a plain form post
// without JavaScript (sent back to the page with the outcome).

const ORIGINS = new Set(["https://aultrum.co.uk", "https://www.aultrum.co.uk"]);
const PAGE = "https://aultrum.co.uk/pleasant/";

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : { Vary: "Origin" };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  let phone = "";
  let trap = "";
  try {
    if (isForm) {
      const form = await request.formData();
      phone = String(form.get("phone") ?? "");
      trap = String(form.get("company_site") ?? "");
    } else {
      const json = (await request.json()) as { phone?: unknown; company_site?: unknown };
      phone = typeof json.phone === "string" ? json.phone : "";
      trap = typeof json.company_site === "string" ? json.company_site : "";
    }
  } catch {
    return Response.json({ ok: false, message: "Enter a UK mobile number." }, { status: 400, headers: cors(request) });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  // A hidden field people never see: anything in it is a bot, which is told it worked.
  const result = trap ? { ok: true as const, message: "Sent. Check your phone and text back to try it." } : await requestTrial({ phone, ip });
  if (isForm) {
    const back = new URL(PAGE);
    back.searchParams.set("pushbot", result.ok ? "sent" : "error");
    back.searchParams.set("note", result.message);
    back.hash = "pushbots";
    return Response.redirect(back.toString(), 303);
  }
  return Response.json(result, { status: result.ok ? 200 : result.status, headers: cors(request) });
}

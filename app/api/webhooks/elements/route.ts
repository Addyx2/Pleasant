import { z } from "zod";

import { verifyElementsWebhook } from "@/lib/elements";
import { handleElementsWebhook } from "@/lib/elements-events";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  installation: z.object({ id: z.string().min(1), module: z.string(), tenantId: z.string().min(1) }),
  data: z.record(z.unknown()).default({}),
});

/** Events from Aultrum Elements: Gateway reports and Peak rewards. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 256 * 1024) return Response.json({ error: "Too large" }, { status: 413 });
  if (!(await verifyElementsWebhook(raw, request.headers.get("authorization")))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Unexpected event shape" }, { status: 400 });
  const result = await handleElementsWebhook(parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ received: true, duplicate: result.duplicate ?? false });
}

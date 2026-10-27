import { publicJwks } from "@/lib/aultrum-id";

export const dynamic = "force-dynamic";

// Pleasant's public key. Aultrum ID checks Pleasant's signed requests
// against it, so no secret is shared between them.
export async function GET() {
  return Response.json(await publicJwks(), { headers: { "Cache-Control": "public, max-age=300" } });
}

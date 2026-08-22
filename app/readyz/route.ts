import { env } from "cloudflare:workers";
import { ensureProfileSeed } from "@/lib/cloudflare-profile-seed";

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS ready").first();
    await ensureProfileSeed();
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "not-ready" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

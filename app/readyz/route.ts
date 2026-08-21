import { env } from "cloudflare:workers";

export async function GET() {
  try {
    await env.DB.prepare("SELECT 1 AS ready").first();
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

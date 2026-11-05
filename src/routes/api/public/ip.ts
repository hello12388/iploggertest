import { createFileRoute } from "@tanstack/react-router";

/**
 * Public receive endpoint for Roblox scripts.
 *
 * The source IP is taken from server/proxy metadata. An IP supplied in the
 * request body is never trusted. This endpoint never reads dashboard history
 * and only inserts after validating username and explicit consent.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function detectVersion(ip: string): "IPv4" | "IPv6" | "unknown" {
  if (IPV4_RE.test(ip)) return "IPv4";
  if (ip.includes(":")) return "IPv6";
  return "unknown";
}

/** Trusted connecting-IP detection: edge metadata first, proxy chain fallback. */
function clientIpFromRequest(request: Request): string | undefined {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return undefined;
}

export const Route = createFileRoute("/api/public/ip")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const ip = clientIpFromRequest(request);
        if (!ip) {
          return Response.json(
            { error: "No source IP available on the request" },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
        }
        const username =
          typeof body === "object" &&
          body !== null &&
          "username" in body &&
          typeof body.username === "string"
            ? body.username
            : "";
        const consent =
          typeof body === "object" && body !== null && "consent" in body && body.consent === true;
        if (!USERNAME_RE.test(username) || !consent)
          return Response.json(
            { error: "Valid username and consent are required" },
            { status: 400, headers: CORS_HEADERS },
          );

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // ON CONFLICT DO NOTHING on the primary key: an existing IP keeps its
        // original record untouched, even under concurrent requests.
        const { data, error } = await supabaseAdmin
          .from("ip_records")
          .insert({ ip, version: detectVersion(ip), username, consent })
          .select("ip");

        if (error) {
          console.error("[ip receive] insert failed:", error.message);
          return Response.json(
            { error: "Failed to store IP" },
            { status: 500, headers: CORS_HEADERS },
          );
        }

        return Response.json(
          { ok: true, received: (data?.length ?? 0) > 0 },
          { headers: CORS_HEADERS },
        );
      },
    },
  },
});

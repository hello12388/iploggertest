import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary in-memory store. Resets when the server restarts —
 * acceptable for this throwaway test project.
 *
 * One record per unique IP: keyed by IP, never overwritten.
 * Handlers run synchronously here, so a duplicate arriving in the same
 * instant still hits the same Map key and cannot create a second record.
 */
const store = new Map<string, IpRecord>();

interface IpRecord {
  ip: string;
  version: "IPv4" | "IPv6" | "unknown";
  firstSeen: string;
}

const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function detectVersion(ip: string): IpRecord["version"] {
  if (IPV4_RE.test(ip)) return "IPv4";
  if (ip.includes(":")) return "IPv6";
  return "unknown";
}

/** Best-effort connecting-IP detection behind the edge proxy. */
function clientIpFromRequest(request: Request): string | undefined {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return undefined;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/ip")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      // Dashboard polls this: all unique IP records, newest first.
      GET: async () => {
        const records = [...store.values()].sort(
          (a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime(),
        );
        return Response.json(
          { records, total: records.length },
          { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
        );
      },

      // Roblox script calls this. The connecting IP is read from proxy
      // headers; a body { "ip": "..." } can override it for local testing.
      POST: async ({ request }) => {
        let bodyIp: unknown;
        try {
          const body = (await request.json()) as { ip?: unknown };
          if (typeof body?.ip === "string") bodyIp = body.ip;
        } catch {
          // Empty or non-JSON body is fine — headers are the primary source.
        }

        const ip =
          (typeof bodyIp === "string" && bodyIp.length <= 45 ? bodyIp : undefined) ??
          clientIpFromRequest(request);

        if (!ip) {
          return Response.json(
            { error: "No IP available" },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        // Deduplication happens here on the endpoint: an existing IP keeps
        // its original record untouched.
        if (!store.has(ip)) {
          store.set(ip, {
            ip,
            version: detectVersion(ip),
            firstSeen: new Date().toISOString(),
          });
        }

        return Response.json({ ok: true, duplicate: store.size > 0 && !store.get(ip) }, { headers: CORS_HEADERS });
      },
    },
  },
});

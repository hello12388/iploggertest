import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary in-memory store. Resets when the server restarts —
 * acceptable for this throwaway test project.
 */
const store: { record: IpRecord | null } = { record: null };

interface IpRecord {
  ip: string;
  version: "IPv4" | "IPv6" | "unknown";
  receivedAt: string;
  count: number;
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

      // Dashboard polls this: latest IP + request count.
      GET: async () =>
        Response.json(
          { record: store.record },
          { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
        ),

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

        const prev = store.record;
        store.record = {
          ip,
          version: detectVersion(ip),
          receivedAt: new Date().toISOString(),
          count: (prev?.count ?? 0) + 1,
        };

        return Response.json({ ok: true, ...store.record }, { headers: CORS_HEADERS });
      },
    },
  },
});

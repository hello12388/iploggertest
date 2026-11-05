import { createFileRoute } from "@tanstack/react-router";
import { isValidSession } from "@/lib/dashboard-session.server";

export const Route = createFileRoute("/api/ip")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isValidSession(request))
          return Response.json(
            { error: "Unauthorized" },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        const params = new URL(request.url).searchParams;
        const page = Math.max(1, Number(params.get("page") || 1) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") || 10) || 10));
        const query = (params.get("q") || "").trim();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let requestQuery = supabaseAdmin
          .from("ip_records")
          .select("id, ip, username, version, first_seen", { count: "exact" })
          .order("first_seen", { ascending: false });
        if (query) requestQuery = requestQuery.or(`ip.ilike.%${query}%,username.ilike.%${query}%`);
        const from = (page - 1) * pageSize;
        const { data, count, error } = await requestQuery.range(from, from + pageSize - 1);
        if (error) {
          console.error("[ip read] query failed:", error.message);
          return Response.json({ error: "Failed to load records" }, { status: 500 });
        }
        return Response.json(
          {
            records: (data ?? []).map((r) => ({
              id: r.id,
              ip: r.ip,
              username: r.username,
              version: r.version,
              firstSeen: r.first_seen,
            })),
            total: count ?? 0,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

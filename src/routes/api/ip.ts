import { createFileRoute } from "@tanstack/react-router";

import { readSessionFromRequest } from "@/lib/dashboard-auth";

export const Route = createFileRoute("/api/ip")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = readSessionFromRequest(request);
        if (!session || session.expiresAt <= Date.now()) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data, error } = await supabaseAdmin
          .from("ip_records")
          .select("ip, version, first_seen")
          .order("first_seen", { ascending: false });

        if (error) {
          console.error("[ip read] query failed:", error.message);
          return Response.json(
            { error: "Failed to load records" },
            { status: 500 },
          );
        }

        return Response.json(
          {
            records: (data ?? []).map((r) => ({
              ip: r.ip,
              version: r.version,
              firstSeen: r.first_seen,
            })),
            total: data?.length ?? 0,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

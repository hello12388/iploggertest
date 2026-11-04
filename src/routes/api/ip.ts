import { createFileRoute } from "@tanstack/react-router";

/**
 * Dashboard-only read endpoint. Deliberately NOT under /api/public/: the
 * records live in a table with row-level security and no public policies, so
 * only this server-side handler (service role) can read them.
 */
export const Route = createFileRoute("/api/ip")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

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
          { records: data ?? [], total: data?.length ?? 0 },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

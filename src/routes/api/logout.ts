import { createFileRoute } from "@tanstack/react-router";

import { clearSessionCookieHeader } from "@/lib/dashboard-auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          { ok: true },
          {
            status: 200,
            headers: {
              "Set-Cookie": clearSessionCookieHeader(),
            },
          },
        );
      },
    },
  },
});

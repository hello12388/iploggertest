import { createFileRoute } from "@tanstack/react-router";

import { readSessionFromRequest } from "@/lib/dashboard-auth";

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = readSessionFromRequest(request);
        if (!session || session.expiresAt <= Date.now()) {
          return Response.json({ authenticated: false }, { status: 200 });
        }

        return Response.json({ authenticated: true }, { status: 200 });
      },
    },
  },
});

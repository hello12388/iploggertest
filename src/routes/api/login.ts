import { createFileRoute } from "@tanstack/react-router";

import {
  checkLoginRateLimit,
  clearLoginFailure,
  buildSessionCookieHeader,
  createDashboardSession,
  recordFailedLogin,
  verifyDashboardPassword,
} from "@/lib/dashboard-auth";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rateLimit = checkLoginRateLimit(request);
        if (rateLimit.blocked) {
          return Response.json(
            {
              ok: false,
              error: `Too many failed login attempts. Please try again in ${rateLimit.retrySeconds} seconds.`,
            },
            { status: 429 },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const parsedBody = body as { password?: unknown };
        const password = typeof parsedBody.password === "string" ? parsedBody.password : "";

        if (!verifyDashboardPassword(password)) {
          recordFailedLogin(request);
          return Response.json(
            {
              ok: false,
              error: "Invalid password.",
            },
            { status: 401 },
          );
        }

        clearLoginFailure(request);
        const session = createDashboardSession();

        return Response.json(
          { ok: true },
          {
            status: 200,
            headers: {
              "Set-Cookie": buildSessionCookieHeader(session),
            },
          },
        );
      },
    },
  },
});

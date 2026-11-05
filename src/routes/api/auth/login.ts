import { createFileRoute } from "@tanstack/react-router";
import { createSessionCookie, isDashboardPassword } from "@/lib/dashboard-session.server";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const now = Date.now();
        const current = attempts.get(ip);
        if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS)
          return Response.json(
            { error: "Too many attempts" },
            { status: 429, headers: { "Retry-After": "900" } },
          );
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const password =
          typeof body === "object" &&
          body !== null &&
          "password" in body &&
          typeof body.password === "string"
            ? body.password
            : "";
        if (!isDashboardPassword(password)) {
          const next =
            current && current.resetAt > now
              ? { count: current.count + 1, resetAt: current.resetAt }
              : { count: 1, resetAt: now + WINDOW_MS };
          attempts.set(ip, next);
          return Response.json({ error: "Invalid credentials" }, { status: 401 });
        }
        attempts.delete(ip);
        return new Response(null, {
          status: 204,
          headers: { "Set-Cookie": createSessionCookie(), "Cache-Control": "no-store" },
        });
      },
    },
  },
});

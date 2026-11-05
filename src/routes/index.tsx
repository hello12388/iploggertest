import { createFileRoute } from "@tanstack/react-router";
import { Activity, ArrowDownToLine, Globe, LogOut, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface IpRecord {
  ip: string;
  version: "IPv4" | "IPv6" | "unknown";
  firstSeen: string;
}

const FRESH_MS = 60_000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IP Receiver Dashboard" },
      {
        name: "description",
        content: "Receive and display unique IP addresses sent from a Roblox script in real time.",
      },
      { property: "og:title", content: "IP Receiver Dashboard" },
      {
        property: "og:description",
        content: "Receive and display unique IP addresses sent from a Roblox script in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = (await res.json().catch(() => ({ authenticated: false }))) as {
        authenticated?: boolean;
      };
      setAuthenticated(res.ok && data.authenticated === true);
    } catch {
      setAuthenticated(false);
    }
  };

  useEffect(() => {
    void checkSession();
  }, []);

  const onLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json().catch(() => ({ ok: false, error: "Invalid password." }))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || data.ok !== true) {
        const message = data.error ?? "Invalid password.";
        setErrorMessage(message);
        setAuthenticated(false);
        return;
      }

      setPassword("");
      setAuthenticated(true);
    } catch {
      setErrorMessage("Login failed. Please try again.");
      setAuthenticated(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // Ignore network hiccups while clearing the session.
    }

    setPassword("");
    setErrorMessage("");
    setAuthenticated(false);
  };

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-sm text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-background text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Protected dashboard
              </p>
              <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
            </div>
          </div>

          <form className="space-y-4" onSubmit={onLogin}>
            <label className="block text-sm font-medium text-foreground">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-0 transition focus:border-primary"
                placeholder="Enter dashboard password"
              />
            </label>

            {errorMessage ? (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <DashboardView onLogout={onLogout} />;
}

function DashboardView({ onLogout }: { onLogout: () => void }) {
  const [records, setRecords] = useState<IpRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/ip", { cache: "no-store" });
        if (!res.ok) {
          if (alive && res.status === 401) {
            onLogout();
          }
          return;
        }

        const data = (await res.json()) as { records?: IpRecord[] };
        if (alive) {
          setRecords(data.records ?? []);
        }
      } catch {
        // Keep prior data on transient network issues.
      }

      if (alive) {
        setNow(Date.now());
      }
    };

    void poll();
    const id = window.setInterval(poll, 3000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [onLogout]);

  const latest = records[0];
  const connected = latest !== undefined && now - new Date(latest.firstSeen).getTime() < FRESH_MS;
  const status = connected ? "Connected" : "Waiting for data";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-5 py-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
              <Globe className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">IP Receiver</h1>
              <p className="text-xs text-muted-foreground">Roblox test endpoint</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
            >
              <LogOut className="size-3.5" />
              Logout
            </button>

            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                connected
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className="relative flex size-2">
                <span
                  className={`absolute inline-flex size-full rounded-full ${
                    connected ? "bg-success" : "bg-muted-foreground animate-pulse"
                  }`}
                />
              </span>
              {status}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5" />
            Unique IPs
          </div>
          <p className="mt-2 font-mono text-5xl font-semibold text-foreground">{records.length}</p>
        </section>

        {records.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <ArrowDownToLine className="size-3.5" />
              Records — newest first
            </div>

            {records.map((record, index) => (
              <article
                key={`${record.ip}-${record.firstSeen}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="truncate font-mono text-lg font-semibold text-foreground">{record.ip}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      record.version === "IPv4"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {record.version}
                  </span>
                  <span className="hidden rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground sm:inline">
                    {formatTime(record.firstSeen)}
                  </span>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-6 text-center text-sm text-muted-foreground">
            No data received yet. Send a POST request to <span className="font-mono text-foreground">/api/public/ip</span> from your Roblox script.
          </p>
        )}

        {latest ? (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Activity className="size-3.5" />
            Last unique IP received {secondsAgo(latest.firstSeen, now)}
          </p>
        ) : null}
      </main>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function secondsAgo(iso: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return `${seconds}s ago`;
}

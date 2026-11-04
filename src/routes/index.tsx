import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowDownToLine, Globe, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IP Receiver Dashboard" },
      {
        name: "description",
        content:
          "Receive and display unique IP addresses sent from a Roblox script in real time.",
      },
      { property: "og:title", content: "IP Receiver Dashboard" },
      {
        property: "og:description",
        content:
          "Receive and display unique IP addresses sent from a Roblox script in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface IpRecord {
  ip: string;
  version: "IPv4" | "IPv6" | "unknown";
  firstSeen: string;
}

const FRESH_MS = 60_000;

function Index() {
  const [records, setRecords] = useState<IpRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/public/ip");
        const data = (await res.json()) as { records: IpRecord[] };
        if (alive) setRecords(data.records);
      } catch {
        // Network hiccup — keep previous state, retry on next tick.
      }
      if (alive) setNow(Date.now());
    };

    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const latest = records[0];
  const connected =
    latest !== undefined &&
    now - new Date(latest.firstSeen).getTime() < FRESH_MS;
  const status = connected ? "Connected" : "Waiting for data";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-5 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
              <Globe className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                IP Receiver
              </h1>
              <p className="text-xs text-muted-foreground">Roblox test endpoint</p>
            </div>
          </div>
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
        </header>

        <section className="rounded-3xl border border-border bg-card p-8 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5" />
            Unique IPs
          </div>
          <p className="mt-2 font-mono text-5xl font-semibold text-foreground">
            {records.length}
          </p>
        </section>

        {records.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <ArrowDownToLine className="size-3.5" />
              Records — newest first
            </div>
            {records.map((r, i) => (
              <article
                key={r.ip}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="truncate font-mono text-lg font-semibold text-foreground">
                    {r.ip}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      r.version === "IPv4"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {r.version}
                  </span>
                  <span className="hidden rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground sm:inline">
                    {formatTime(r.firstSeen)}
                  </span>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-6 text-center text-sm text-muted-foreground">
            No data received yet. Send a POST request to{" "}
            <span className="font-mono text-foreground">/api/public/ip</span> from your
            Roblox script — this page updates automatically.
          </p>
        )}

        {latest && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Activity className="size-3.5" />
            Last unique IP received {secondsAgo(latest.firstSeen, now)}
          </p>
        )}
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
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return `${s}s ago`;
}

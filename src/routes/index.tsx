import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowDownToLine, Globe, LogOut, RefreshCw, Search, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "IP Receiver Dashboard" }] }),
  component: Index,
});
interface IpRecord {
  id: string;
  ip: string;
  username: string | null;
  version: "IPv4" | "IPv6" | "unknown";
  firstSeen: string;
}
const PAGE_SIZE = 10;

function Index() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<IpRecord[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      q: query,
    });
    const res = await fetch(`/api/ip?${params}`, { cache: "no-store" });
    if (res.status === 401) {
      await navigate({ to: "/login" });
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as { records: IpRecord[]; total: number };
    setRecords(data.records);
    setTotal(data.total);
    setNow(Date.now());
    setLoading(false);
  };
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 2000);
    return () => clearInterval(id);
  }, [page, query]);
  const latest = records[0];
  const connected = latest && now - new Date(latest.firstSeen).getTime() < 60_000;
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await navigate({ to: "/login" });
  }
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:py-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
              <Globe className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">IP Receiver</h1>
              <p className="text-xs text-muted-foreground">Protected Roblox dashboard</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium hover:bg-secondary"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>
        <section className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search username or IP"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Search username or IP"
              className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            onClick={() => void load()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Users className="size-3.5" /> Received records
          </div>
          <p className="mt-2 font-mono text-5xl font-semibold">{total}</p>
        </section>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading protected data…</p>
        ) : records.length ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <ArrowDownToLine className="size-3.5" /> Records — newest first
            </div>
            {records.map((r, i) => (
              <article
                key={r.id}
                className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                      {String((page - 1) * PAGE_SIZE + i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.username ?? "Unknown user"}</p>
                      <p className="truncate font-mono text-sm text-muted-foreground">{r.ip}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {r.version}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="size-3.5" />
                  {formatTime(r.firstSeen)}
                </p>
              </article>
            ))}
          </section>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            No matching records.
          </p>
        )}
        {total > PAGE_SIZE && (
          <nav className="flex items-center justify-between" aria-label="Pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              disabled={page >= Math.ceil(total / PAGE_SIZE)}
              onClick={() => setPage(page + 1)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        )}
        {latest && (
          <p className="text-center text-xs text-muted-foreground">
            Latest status: {connected ? "Connected" : "Waiting for data"}
          </p>
        )}
      </main>
    </div>
  );
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" });
}

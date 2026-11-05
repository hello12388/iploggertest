import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · IP Receiver" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (event.nativeEvent instanceof SubmitEvent && event.nativeEvent.isComposing) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) {
      await navigate({ to: "/" });
      return;
    }
    setPassword("");
    setError(response.status === 429 ? "Too many attempts. Try again later." : "Invalid password.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Protected dashboard
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to continue</h1>
          </div>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Dashboard password
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-base outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Enter your password"
              />
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
        <Link
          to="/"
          className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

const buttonClass =
  "h-10 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb] disabled:opacity-50";

export default function LoginPage() {
  const [stage, setStage] = useState<"password" | "code">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect password.");
        return;
      }
      setStage("code");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect code.");
        return;
      }
      // A plain router.push() here can race with proxy re-checking the
      // freshly-set session cookie and silently no-op (Next's client router
      // cancels the transition), which then made a *second* click resubmit
      // the same code against a pending cookie the first request already
      // consumed — surfacing as a confusing "expired code" error. A hard
      // navigation sidesteps the router cache entirely.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">stits</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {stage === "password"
            ? "Enter your password to continue."
            : "Check your phone for a 6-digit code."}
        </p>
      </div>

      {stage === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className={fieldClass}
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            required
            className={fieldClass}
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </main>
  );
}

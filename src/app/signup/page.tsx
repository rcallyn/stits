"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

const buttonClass =
  "h-10 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb] disabled:opacity-50";

const linkClass = "text-[#0071e3] hover:underline dark:text-[#2997ff]";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 400
            ? "Enter a valid email and a password of at least 8 characters."
            : (data.error ?? "Couldn't send the request.")
        );
        return;
      }
      setRequested(true);
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
          {requested ? "Request sent." : "Request an account."}
        </p>
      </div>

      {requested ? (
        <p className="text-sm">
          You&apos;ll be able to sign in with {email} once your account is approved.{" "}
          <Link href="/login" className={linkClass}>
            Back to sign in
          </Link>
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={fieldClass}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (8+ characters)"
              minLength={8}
              required
              className={fieldClass}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              minLength={8}
              required
              className={fieldClass}
            />
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Sending…" : "Request account"}
            </button>
          </form>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            New accounts are approved by hand.{" "}
            <Link href="/login" className={linkClass}>
              Already have one? Sign in
            </Link>
          </p>
        </>
      )}
    </main>
  );
}

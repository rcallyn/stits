"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountPayload } from "@/app/api/account/route";
import UsersPanel from "@/components/UsersPanel";

const fieldClass =
  "rounded-[10px] border border-black/[.06] bg-black/[.025] px-3 py-2 text-sm outline-none transition-colors focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 dark:border-white/[.08] dark:bg-white/[.05] dark:focus:border-[#2997ff] dark:focus:ring-[#2997ff]/20";

const buttonClass =
  "h-10 shrink-0 rounded-lg bg-[#0071e3] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0077ed] active:bg-[#006edb] disabled:opacity-50";

const secondaryButtonClass =
  "h-10 shrink-0 rounded-lg border border-black/[.12] px-4 text-sm font-medium text-zinc-500 transition-colors hover:bg-black/[.03] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-white/[.06]";

type Status = { kind: "ok" | "error"; text: string } | null;

// Zod failures come back as a generic "Invalid request.", so those get a
// message written for the form instead.
async function errorFrom(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error && data.error !== "Invalid request." ? data.error : fallback;
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      className={`mt-2 text-sm ${
        status.kind === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      {status.text}
    </p>
  );
}

export default function AccountPanel() {
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [pushoverKey, setPushoverKey] = useState("");
  const [pushoverPassword, setPushoverPassword] = useState("");
  const [pushoverStatus, setPushoverStatus] = useState<Status>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [sessionsStatus, setSessionsStatus] = useState<Status>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AccountPayload | null) => setAccount(data))
      .catch(() => {});
  }, []);

  async function savePushover(key: string | null) {
    setBusy(true);
    setPushoverStatus(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pushoverPassword, pushoverUserKey: key }),
      });
      if (!res.ok) {
        setPushoverStatus({
          kind: "error",
          text: await errorFrom(res, "That isn't a valid 30-character Pushover user key."),
        });
        return;
      }
      setAccount(await res.json());
      setPushoverKey("");
      setPushoverPassword("");
      setPushoverStatus({
        kind: "ok",
        text: key
          ? "Saved. Sign-in codes and the 7am digest will go to Pushover."
          : "Pushover turned off.",
      });
    } catch {
      setPushoverStatus({ kind: "error", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPasswordStatus(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        setPasswordStatus({
          kind: "error",
          text: await errorFrom(res, "The new password must be at least 8 characters."),
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus({ kind: "ok", text: "Password changed. Other devices have been signed out." });
    } catch {
      setPasswordStatus({ kind: "error", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm("Log out of stits on every device, including this one?")) return;
    setBusy(true);
    setSessionsStatus(null);
    try {
      const res = await fetch("/api/logout-all", { method: "POST" });
      if (!res.ok) {
        setSessionsStatus({ kind: "error", text: "Couldn't log out everywhere. Try again." });
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setSessionsStatus({ kind: "error", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  if (!account) return null;

  return (
    <>
      <section className="rounded-xl bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none">
        <h2 className="text-sm font-semibold">Account</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Signed in as {account.email}.</p>

        <h3 className="mt-4 text-sm font-medium">Pushover</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {account.hasPushover
            ? "On: signing in needs a code pushed to your phone, and you get the 7am digest."
            : "Add your Pushover user key (from the Pushover app or pushover.net) to get a sign-in code on your phone and the 7am digest."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            savePushover(pushoverKey.trim());
          }}
          className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input
            type="password"
            autoComplete="off"
            value={pushoverKey}
            onChange={(e) => setPushoverKey(e.target.value)}
            placeholder={account.hasPushover ? "Replace user key" : "Pushover user key"}
            required
            className={`${fieldClass} flex-1`}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={pushoverPassword}
            onChange={(e) => setPushoverPassword(e.target.value)}
            placeholder="Current password"
            required
            className={`${fieldClass} flex-1`}
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            Save
          </button>
          {account.hasPushover && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!pushoverPassword) {
                  setPushoverStatus({ kind: "error", text: "Enter your current password first." });
                  return;
                }
                if (window.confirm("Turn off Pushover? Signing in will need only your password.")) {
                  savePushover(null);
                }
              }}
              className={secondaryButtonClass}
            >
              Turn off
            </button>
          )}
        </form>
        <StatusLine status={pushoverStatus} />

        <h3 className="mt-4 text-sm font-medium">Change password</h3>
        <form onSubmit={changePassword} className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
            className={`${fieldClass} flex-1`}
          />
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            minLength={8}
            required
            className={`${fieldClass} flex-1`}
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            Change
          </button>
        </form>
        <StatusLine status={passwordStatus} />

        <h3 className="mt-4 text-sm font-medium">Sessions</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Signs out every device, including this one. Use it if a phone or browser is lost.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={logoutEverywhere}
          className="mt-2 h-10 rounded-lg border border-red-500/60 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/[.06] disabled:opacity-50 dark:text-red-400"
        >
          Log out everywhere
        </button>
        <StatusLine status={sessionsStatus} />
      </section>

      {account.isAdmin && <UsersPanel />}
    </>
  );
}

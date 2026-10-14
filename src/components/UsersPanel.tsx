"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminUser } from "@/app/api/admin/users/route";

const smallButtonClass =
  "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50";

async function fetchUsers(): Promise<AdminUser[] | null> {
  const res = await fetch("/api/admin/users").catch(() => null);
  return res?.ok ? (await res.json()).users : null;
}

// Admin-only: approve or reject signup requests and remove accounts.
export default function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchUsers().then((list) => {
      if (list) setUsers(list);
      else setError("Couldn't load users.");
    });
  }, []);

  useEffect(load, [load]);

  async function act(user: AdminUser, action: "approve" | "remove") {
    if (action === "remove") {
      const message =
        user.status === "pending"
          ? `Reject ${user.email}'s request?`
          : `Remove ${user.email} and permanently delete all of their todos and events?`;
      if (!window.confirm(message)) return;
    }
    setBusyId(user.id);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: action === "approve" ? "PATCH" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: action === "approve" ? JSON.stringify({ status: "active" }) : undefined,
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) {
      setError("That didn't work. Try again.");
      return;
    }
    load();
  }

  const pendingCount = users?.filter((u) => u.status === "pending").length ?? 0;

  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.08)] dark:bg-[#1c1c1e] dark:shadow-none">
      <h2 className="text-sm font-semibold">
        Users
        {pendingCount > 0 && (
          <span className="ml-2 rounded-full bg-[#0071e3] px-2 py-0.5 text-xs font-medium text-white">
            {pendingCount} waiting
          </span>
        )}
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        People can request an account at /signup. They can&apos;t sign in until you approve them.
        Email addresses aren&apos;t verified, so only approve people you&apos;ve heard from directly.
      </p>

      {users && (
        <ul className="mt-3 flex flex-col gap-1">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-black/[.02] dark:hover:bg-white/[.03]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.email}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {user.isAdmin ? "Admin" : user.status === "pending" ? "Waiting for approval" : "Active"}
                  {" · "}joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              {!user.isAdmin && (
                <div className="flex gap-2">
                  {user.status === "pending" && (
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      onClick={() => act(user, "approve")}
                      className={`${smallButtonClass} bg-[#0071e3] text-white hover:bg-[#0077ed]`}
                    >
                      Approve
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === user.id}
                    onClick={() => act(user, "remove")}
                    className={`${smallButtonClass} text-zinc-500 hover:text-red-500`}
                  >
                    {user.status === "pending" ? "Reject" : "Remove"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </section>
  );
}

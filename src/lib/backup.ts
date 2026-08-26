import { Todo } from "@/lib/todos";
import { ScheduleEvent } from "@/lib/schedule";
import { Note } from "@/lib/notes";

export type BackupData = {
  version: 1;
  exportedAt: string;
  todos: Todo[];
  scheduleEvents: ScheduleEvent[];
  notes: Note[];
  categoryColors: Record<string, string>;
  categoryLabels: Record<string, string>;
  categoryOrder: string[];
};

function readJSON<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Reads whatever's still sitting in this browser's localStorage from before
// the app moved to a server-backed database. Used once, by the "Import this
// browser's data" migration button on the Other page — not by the ongoing
// Export/Import-backup buttons below, which now read the live server data.
export function buildLocalStorageBackup(): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: readJSON("stits:todos", []),
    scheduleEvents: readJSON("stits:schedule-events", []),
    notes: readJSON("stits:notes", []),
    categoryColors: readJSON("stits:category-colors", {}),
    categoryLabels: readJSON("stits:category-labels", {}),
    categoryOrder: readJSON("stits:category-order", []),
  };
}

export async function buildServerBackup(): Promise<BackupData> {
  const [todosRes, eventsRes, notesRes, settingsRes] = await Promise.all([
    fetch("/api/todos"),
    fetch("/api/events"),
    fetch("/api/notes"),
    fetch("/api/settings"),
  ]);
  const [todosData, eventsData, notesData, settings] = await Promise.all([
    todosRes.json(),
    eventsRes.json(),
    notesRes.json(),
    settingsRes.json(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: todosData.todos ?? [],
    scheduleEvents: eventsData.events ?? [],
    notes: notesData.notes ?? [],
    categoryColors: settings.categoryColors ?? {},
    categoryLabels: settings.categoryLabels ?? {},
    categoryOrder: settings.categoryOrder ?? [],
  };
}

export async function downloadBackup() {
  const data = await buildServerBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stits-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.todos) && Array.isArray(v.scheduleEvents) && Array.isArray(v.notes);
}

// Replaces all server-backed data with the contents of a backup file —
// matches what this button has always told the user it does ("will replace
// all current todos, events, and notes").
export async function applyBackup(data: BackupData) {
  await fetch("/api/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, replace: true }),
  });
  window.location.reload();
}

// One-time pull of this browser's pre-migration localStorage data into the
// database, without disturbing anything already there.
export async function importLocalStorageBackup() {
  const data = buildLocalStorageBackup();
  await fetch("/api/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, replace: false }),
  });
  window.location.reload();
}

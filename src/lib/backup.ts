import { Todo, TODOS_STORAGE_KEY } from "@/lib/todos";
import { ScheduleEvent, SCHEDULE_STORAGE_KEY } from "@/lib/schedule";
import { Note, NOTES_STORAGE_KEY } from "@/lib/notes";

const CATEGORY_COLORS_KEY = "stits:category-colors";
const CATEGORY_LABELS_KEY = "stits:category-labels";
const CATEGORY_ORDER_KEY = "stits:category-order";

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

export function buildBackup(): BackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: readJSON(TODOS_STORAGE_KEY, []),
    scheduleEvents: readJSON(SCHEDULE_STORAGE_KEY, []),
    notes: readJSON(NOTES_STORAGE_KEY, []),
    categoryColors: readJSON(CATEGORY_COLORS_KEY, {}),
    categoryLabels: readJSON(CATEGORY_LABELS_KEY, {}),
    categoryOrder: readJSON(CATEGORY_ORDER_KEY, []),
  };
}

export function downloadBackup() {
  const data = buildBackup();
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

// Writes straight to localStorage and reloads, rather than pushing through
// each hook's in-memory store — simplest way to guarantee every store
// (already-hydrated or not) picks up the imported data consistently.
export function applyBackup(data: BackupData) {
  window.localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(data.todos ?? []));
  window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(data.scheduleEvents ?? []));
  window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(data.notes ?? []));
  window.localStorage.setItem(CATEGORY_COLORS_KEY, JSON.stringify(data.categoryColors ?? {}));
  window.localStorage.setItem(CATEGORY_LABELS_KEY, JSON.stringify(data.categoryLabels ?? {}));
  window.localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(data.categoryOrder ?? []));
  window.location.reload();
}

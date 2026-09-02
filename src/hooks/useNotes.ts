"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Note, sortNotes } from "@/lib/notes";
import { createEntityStore } from "@/lib/createEntityStore";

const JSON_HEADERS = { "Content-Type": "application/json" };

export const noteStore = createEntityStore<Note>({
  endpoint: "/api/notes",
  fromResponse: (data) => sortNotes((data as { notes?: Note[] }).notes ?? []),
  noun: "note",
});

export function useNotes() {
  useEffect(() => {
    noteStore.ensureHydrated();
  }, []);

  const notes = useSyncExternalStore(
    noteStore.subscribe,
    noteStore.getSnapshot,
    noteStore.getServerSnapshot
  );
  const loaded = useSyncExternalStore(
    noteStore.subscribe,
    noteStore.getHydratedSnapshot,
    noteStore.getServerHydratedSnapshot
  );

  const addNote = useCallback((note: Omit<Note, "id" | "createdAt">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    noteStore.mutate(
      (cur) => sortNotes([...cur, { ...note, id: tempId, createdAt }]),
      () => fetch("/api/notes", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(note) }),
      { action: "add" }
    );
  }, []);

  const updateNote = useCallback((id: string, changes: Partial<Omit<Note, "id" | "createdAt">>) => {
    noteStore.mutate(
      (cur) => sortNotes(cur.map((note) => (note.id === id ? { ...note, ...changes } : note))),
      () =>
        fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify(changes),
        }),
      { action: "update" }
    );
  }, []);

  const removeNote = useCallback((id: string) => {
    noteStore.mutate(
      (cur) => cur.filter((note) => note.id !== id),
      () => fetch(`/api/notes/${id}`, { method: "DELETE" }),
      { action: "delete" }
    );
  }, []);

  const togglePinNote = useCallback((id: string) => {
    const target = noteStore.getAll().find((note) => note.id === id);
    if (!target) return;
    const pinned = !target.pinned;
    noteStore.mutate(
      (cur) => sortNotes(cur.map((note) => (note.id === id ? { ...note, pinned } : note))),
      () =>
        fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ pinned }),
        }),
      { action: "update" }
    );
  }, []);

  return { notes, loaded, addNote, updateNote, removeNote, togglePinNote };
}

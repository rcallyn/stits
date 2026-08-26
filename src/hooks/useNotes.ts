"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Note, sortNotes } from "@/lib/notes";

let store: Note[] = [];
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: Note[]) {
  store = next;
  emit();
}

async function refresh() {
  try {
    const res = await fetch("/api/notes");
    const data = await res.json();
    setStore(sortNotes(data.notes ?? []));
  } catch {
    // Leave the cache as-is on a network failure — the next successful
    // mutation's refresh will resync it.
  }
}

function ensureHydrated() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  refresh().finally(() => {
    hydrated = true;
    hydrating = false;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getStoreSnapshot() {
  return store;
}

function getHydratedSnapshot() {
  return hydrated;
}

const EMPTY_NOTES: Note[] = [];

export function useNotes() {
  useEffect(() => {
    ensureHydrated();
  }, []);

  const notes = useSyncExternalStore(subscribe, getStoreSnapshot, () => EMPTY_NOTES);
  const loaded = useSyncExternalStore(subscribe, getHydratedSnapshot, () => false);

  const addNote = useCallback((note: Omit<Note, "id" | "createdAt">) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    setStore(sortNotes([...store, { ...note, id: tempId, createdAt: new Date().toISOString() }]));
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    }).finally(refresh);
  }, []);

  const updateNote = useCallback((id: string, changes: Partial<Omit<Note, "id" | "createdAt">>) => {
    setStore(sortNotes(store.map((note) => (note.id === id ? { ...note, ...changes } : note))));
    fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }).finally(refresh);
  }, []);

  const removeNote = useCallback((id: string) => {
    setStore(store.filter((note) => note.id !== id));
    fetch(`/api/notes/${id}`, { method: "DELETE" }).finally(refresh);
  }, []);

  const togglePinNote = useCallback((id: string) => {
    const target = store.find((note) => note.id === id);
    if (!target) return;
    const pinned = !target.pinned;
    setStore(sortNotes(store.map((note) => (note.id === id ? { ...note, pinned } : note))));
    fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }).finally(refresh);
  }, []);

  return { notes, loaded, addNote, updateNote, removeNote, togglePinNote };
}

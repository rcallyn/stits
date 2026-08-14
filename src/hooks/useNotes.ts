"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { NOTES_STORAGE_KEY, Note, sortNotes } from "@/lib/notes";

let store: Note[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setStore(next: Note[]) {
  store = next;
  window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(store));
  emit();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
  if (raw) {
    try {
      store = sortNotes(JSON.parse(raw));
    } catch {
      store = [];
    }
  }
  hydrated = true;
  emit();
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
    setStore(
      sortNotes([
        ...store,
        { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ])
    );
  }, []);

  const updateNote = useCallback((id: string, changes: Partial<Omit<Note, "id" | "createdAt">>) => {
    setStore(sortNotes(store.map((note) => (note.id === id ? { ...note, ...changes } : note))));
  }, []);

  const removeNote = useCallback((id: string) => {
    setStore(store.filter((note) => note.id !== id));
  }, []);

  const togglePinNote = useCallback((id: string) => {
    setStore(
      sortNotes(store.map((note) => (note.id === id ? { ...note, pinned: !note.pinned } : note)))
    );
  }, []);

  return { notes, loaded, addNote, updateNote, removeNote, togglePinNote };
}

import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";

// Shared request-body schemas for the API routes. Everything crossing the
// network boundary is parsed through one of these instead of being cast with
// `as Partial<T>` and trusted. Field shapes mirror the domain types in
// lib/todos, lib/notes, and lib/schedule.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const categorySchema = z.enum(
  Object.keys(CATEGORIES) as [keyof typeof CATEGORIES, ...(keyof typeof CATEGORIES)[]]
);

export const dateSchema = z.string().regex(ISO_DATE, "expected YYYY-MM-DD");
export const timeSchema = z.union([z.literal(""), z.string().regex(HH_MM, "expected HH:MM")]);

const title = z.string().trim().min(1).max(500);

/* ------------------------------- todos ---------------------------------- */

export const subtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(500),
  done: z.boolean(),
});

export const todoPrioritySchema = z.enum(["high", "medium", "low"]);

export const todoCreateSchema = z.object({
  title,
  dueDate: dateSchema.optional(),
  category: categorySchema.optional(),
  priority: todoPrioritySchema.optional(),
  subtasks: z.array(subtaskSchema).optional(),
  canvasId: z.string().max(500).optional(),
});

export const todoPatchSchema = z
  .object({
    title,
    done: z.boolean(),
    dueDate: dateSchema.nullable(),
    category: categorySchema.nullable(),
    priority: todoPrioritySchema.nullable(),
    subtasks: z.array(subtaskSchema).nullable(),
    completedAt: z.iso.datetime().nullable(),
  })
  .partial();

/* ------------------------------- notes ---------------------------------- */

export const noteCreateSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  tag: categorySchema,
});

export const notePatchSchema = z
  .object({
    text: z.string().trim().min(1).max(10_000),
    tag: categorySchema,
    pinned: z.boolean().nullable(),
  })
  .partial();

/* ---------------------------- schedule events -------------------------- */

export const attachedNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(10_000),
  sourceNoteId: z.string().optional(),
});

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(365),
  until: dateSchema.optional(),
  exceptions: z.array(dateSchema).optional(),
});

export const eventCreateSchema = z.object({
  title,
  date: dateSchema,
  endDate: dateSchema.optional(),
  time: timeSchema.optional(),
  endTime: z.string().regex(HH_MM).optional(),
  todoId: z.uuid().optional(),
  category: categorySchema.optional(),
  done: z.boolean().optional(),
  notes: z.array(attachedNoteSchema).optional(),
  isNoteEvent: z.boolean().optional(),
  recurrence: recurrenceSchema.optional(),
  canvasId: z.string().max(500).optional(),
});

export const eventPatchSchema = z
  .object({
    title,
    date: dateSchema,
    endDate: dateSchema.nullable(),
    time: timeSchema,
    endTime: z.string().regex(HH_MM).nullable(),
    done: z.boolean().nullable(),
    category: categorySchema.nullable(),
    notes: z.array(attachedNoteSchema).nullable(),
    recurrence: recurrenceSchema.nullable(),
  })
  .partial();

/* ------------------------------ settings ------------------------------- */

const categoryStringRecord = z.partialRecord(categorySchema, z.string().max(200));

export const settingsPatchSchema = z
  .object({
    categoryColors: categoryStringRecord,
    categoryLabels: categoryStringRecord,
    categoryOrder: z.array(categorySchema),
    canvasFeedUrl: z.string().max(2000),
    canvasLastSyncedAt: z.iso.datetime().nullable(),
  })
  .partial();

/* ---------------------------- misc endpoints -------------------------- */

export const quickAddRequestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  now: z.string().max(100).optional(),
  history: z.array(z.string().max(500)).max(200).optional(),
});

export const canvasSyncRequestSchema = z.object({
  feedUrl: z.string().trim().min(1).max(2000),
});

/* ---------------------------- backup import -------------------------- */

// The /api/migrate payload: a full export file, or the one-time pull of a
// browser's pre-migration localStorage. Rows carry their own ids here (unlike
// the create endpoints) because import has to preserve cross-references
// (todo_id links, note sourceNoteId). `replace: true` wipes the tables first
// and additionally requires an explicit confirm string.
const backupTodoSchema = todoCreateSchema.extend({
  id: z.uuid(),
  done: z.boolean().optional(),
  completedAt: z.iso.datetime().nullish(),
});

const backupEventSchema = eventCreateSchema.extend({
  id: z.uuid(),
});

const backupNoteSchema = noteCreateSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  pinned: z.boolean().nullish(),
});

export const REPLACE_CONFIRMATION = "REPLACE ALL DATA";

export const backupImportSchema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().max(100).optional(),
  todos: z.array(backupTodoSchema).max(20_000),
  scheduleEvents: z.array(backupEventSchema).max(20_000),
  notes: z.array(backupNoteSchema).max(20_000),
  categoryColors: categoryStringRecord.optional(),
  categoryLabels: categoryStringRecord.optional(),
  categoryOrder: z.array(categorySchema).optional(),
  replace: z.boolean().optional(),
  confirm: z.string().optional(),
});

import type { SettingsPayload } from "@/hooks/settingsStore";
import { baseEventId, ScheduleEvent } from "@/lib/schedule";
import { Todo } from "@/lib/todos";
import {
  eventCreateSchema,
  eventPatchSchema,
  quickAddRequestSchema,
  settingsPatchSchema,
  todoCreateSchema,
  todoPatchSchema,
} from "@/lib/schemas";
import { DemoData } from "@/lib/demo/demoData";
import { parseQuickAddOffline } from "@/lib/demo/demoQuickAdd";

// An in-browser stand-in for the /api routes, used only in demo mode. It
// keeps the same request/response shapes and validates bodies with the same
// Zod schemas, so the real pages and stores run against it unchanged; it
// just reads and writes a plain object instead of Postgres.

export type DemoResponse = { status: number; body: unknown };

const ok = (body: unknown = { ok: true }): DemoResponse => ({ status: 200, body });
const fail = (status: number, error: string): DemoResponse => ({ status, body: { error } });

const OFF_IN_DEMO = "That's turned off in the demo.";

// The real PATCH routes treat `null` as "clear this field".
function applyPatch<T extends object>(target: T, changes: Record<string, unknown>): T {
  const next = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  return next as T;
}

export function handleDemoRequest(
  state: DemoData,
  method: string,
  pathname: string,
  body: unknown,
  newId: () => string = () => crypto.randomUUID()
): DemoResponse {
  const [, , resource, id] = pathname.split("/"); // "", "api", resource, id?
  const route = `${method.toUpperCase()} ${resource}${id ? "/:id" : ""}`;

  switch (route) {
    case "GET todos":
      return ok({ todos: state.todos });
    case "POST todos": {
      const parsed = todoCreateSchema.safeParse(body);
      if (!parsed.success) return fail(400, "Invalid todo.");
      const todo: Todo = { ...parsed.data, id: newId(), done: false };
      state.todos.push(todo);
      return ok({ todo });
    }
    case "PATCH todos/:id": {
      const parsed = todoPatchSchema.safeParse(body);
      if (!parsed.success) return fail(400, "Invalid todo.");
      state.todos = state.todos.map((t) => (t.id === id ? applyPatch(t, parsed.data) : t));
      return ok();
    }
    case "DELETE todos/:id":
      state.todos = state.todos.filter((t) => t.id !== id);
      // Mirrors the todo_id foreign key's cascade.
      state.events = state.events.filter((e) => e.todoId !== id);
      return ok();

    case "GET events":
      return ok({ events: state.events });
    case "POST events": {
      const parsed = eventCreateSchema.safeParse(body);
      if (!parsed.success) return fail(400, "Invalid event.");
      const { todoId, ...rest } = parsed.data;
      const event: ScheduleEvent = {
        ...rest,
        id: newId(),
        time: rest.time ?? "",
        ...(todoId && state.todos.some((t) => t.id === todoId) ? { todoId } : {}),
      };
      state.events.push(event);
      return ok({ event });
    }
    case "PATCH events/:id": {
      const parsed = eventPatchSchema.safeParse(body);
      if (!parsed.success) return fail(400, "Invalid event.");
      const realId = baseEventId(decodeURIComponent(id));
      state.events = state.events.map((e) => (e.id === realId ? applyPatch(e, parsed.data) : e));
      return ok();
    }
    case "DELETE events/:id": {
      const realId = baseEventId(decodeURIComponent(id));
      state.events = state.events.filter((e) => e.id !== realId);
      return ok();
    }

    case "GET settings":
      return ok(state.settings);
    case "PATCH settings": {
      const parsed = settingsPatchSchema.safeParse(body);
      if (!parsed.success) return fail(400, "Invalid settings.");
      state.settings = applyPatch(state.settings, parsed.data) as SettingsPayload;
      return ok(state.settings);
    }

    case "POST quick-add": {
      const parsed = quickAddRequestSchema.safeParse(body);
      if (!parsed.success) return fail(400, "Type something to add.");
      const item = parseQuickAddOffline(parsed.data.text);
      if (!item) return fail(422, "Could not parse that into an event or todo.");
      return ok({ item });
    }

    case "GET account":
      return ok({ email: "demo.student@example.com", isAdmin: false, hasPushover: false });
    case "PATCH account":
      return fail(403, OFF_IN_DEMO);
    case "POST canvas-sync":
      return fail(403, "Canvas sync is turned off in the demo — the sample assignments stand in for a synced course.");
    case "POST migrate":
      return fail(403, "Importing a backup is turned off in the demo.");
    case "POST logout":
      return ok();
  }

  // Password changes, the admin user list, and anything else.
  return fail(pathname.startsWith("/api/account/") || pathname.startsWith("/api/admin/") ? 403 : 404, OFF_IN_DEMO);
}

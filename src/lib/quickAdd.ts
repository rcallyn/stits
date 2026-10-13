import { z } from "zod";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { AnthropicError } from "@anthropic-ai/sdk/core/error";
import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const RepeatSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Repeat every N days/weeks/months, omit for 1"),
  weekdays: z
    .array(z.enum(WEEKDAYS))
    .optional()
    .describe(
      'Only for freq "weekly": the days of the week it happens on (e.g. MWF = mon, wed, fri). Omit to repeat on the date\'s own weekday'
    ),
  until: z
    .string()
    .optional()
    .describe("Last date of the repetition in YYYY-MM-DD format, omit if it repeats indefinitely"),
});

export const ParsedItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("event"),
    title: z.string().describe("Short title for the event"),
    date: z.string().describe("Event date in YYYY-MM-DD format"),
    time: z
      .string()
      .optional()
      .describe("Start time in 24h HH:MM format, omit for an all-day event"),
    endTime: z
      .string()
      .optional()
      .describe(
        "End time in 24h HH:MM format, omit if no duration was mentioned or implied"
      ),
    repeat: RepeatSchema.optional().describe(
      'Only when the text says the event recurs ("every Monday", "daily", "gym MWF at 7"); omit for one-off events. "date" is then the first occurrence'
    ),
  }),
  z.object({
    kind: z.literal("todo"),
    title: z.string().describe("Short title for the task"),
    dueDate: z
      .string()
      .optional()
      .describe("Due date in YYYY-MM-DD format, omit if none was mentioned"),
  }),
]);

export type ParsedItem = z.infer<typeof ParsedItemSchema>;
export type ParsedEvent = Extract<ParsedItem, { kind: "event" }>;

export type QuickAddEventPayload = {
  title: string;
  date: string;
  time: string;
  endTime?: string;
  recurrence?: { freq: "daily" | "weekly" | "monthly"; interval: number; until?: string };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Turns a parsed quick-add event into the event(s) to create. A recurrence
 * rule has no notion of "which weekdays", so "gym MWF at 7" becomes one weekly
 * series per weekday, each anchored on the first matching date on/after
 * `item.date`. Malformed model output (bad dates/times) is dropped rather than
 * stored: returns [] if the start date itself is unusable.
 */
export function buildQuickAddEvents(item: ParsedEvent): QuickAddEventPayload[] {
  if (!DATE_RE.test(item.date)) return [];
  const base = {
    title: item.title,
    time: item.time && TIME_RE.test(item.time) ? item.time : "",
    endTime: item.endTime && TIME_RE.test(item.endTime) ? item.endTime : undefined,
  };
  const repeat = item.repeat;
  if (!repeat) return [{ ...base, date: item.date }];

  const until = repeat.until && DATE_RE.test(repeat.until) ? repeat.until : undefined;
  const interval = repeat.interval ?? 1;
  const days = repeat.freq === "weekly" ? [...new Set(repeat.weekdays ?? [])] : [];

  if (days.length === 0) {
    if (until && until < item.date) return [{ ...base, date: item.date }];
    return [{ ...base, date: item.date, recurrence: { freq: repeat.freq, interval, ...(until ? { until } : {}) } }];
  }

  const start = weekdayOf(item.date);
  const payloads = days
    .map((name) => {
      const target = WEEKDAYS.indexOf(name);
      return addDays(item.date, (target - start + 7) % 7);
    })
    .filter((date) => !until || date <= until)
    .sort()
    .map((date) => ({
      ...base,
      date,
      recurrence: { freq: "weekly" as const, interval, ...(until ? { until } : {}) },
    }));
  return payloads.length ? payloads : [{ ...base, date: item.date }];
}

/** Short human description of a repeat rule for the confirmation message. */
export function describeRepeat(repeat: NonNullable<ParsedEvent["repeat"]>): string {
  const unit = { daily: "day", weekly: "week", monthly: "month" }[repeat.freq];
  const every = !repeat.interval || repeat.interval === 1 ? `every ${unit}` : `every ${repeat.interval} ${unit}s`;
  const days = repeat.freq === "weekly" && repeat.weekdays?.length ? ` (${repeat.weekdays.join("/")})` : "";
  return `${every}${days}${repeat.until ? ` until ${repeat.until}` : ""}`;
}

/**
 * The SDK's built-in `zodOutputFormat` helper hardcodes `reused: 'ref'` when
 * generating JSON schema, which hoists shared subschemas into `$defs` and
 * `$ref`s. For a discriminated union that becomes `anyOf` + `$defs` at the
 * same level, which the Claude API rejects ("For 'anyOf', $defs is not
 * supported"). Generating with `reused: 'inline'` avoids `$defs` entirely.
 */
export function parsedItemOutputFormat(): AutoParseableOutputFormat<ParsedItem> {
  const jsonSchema = transformJSONSchema(
    z.toJSONSchema(ParsedItemSchema, { reused: "inline" })
  );

  return {
    type: "json_schema",
    schema: { ...jsonSchema },
    parse: (content: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        throw new AnthropicError(
          `Failed to parse structured output as JSON: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      const output = ParsedItemSchema.safeParse(parsed);
      if (!output.success) {
        throw new AnthropicError(
          `Failed to parse structured output: ${output.error.message}`
        );
      }
      return output.data;
    },
  };
}

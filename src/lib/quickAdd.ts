import { z } from "zod";

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

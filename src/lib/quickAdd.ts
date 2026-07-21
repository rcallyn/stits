import { z } from "zod";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { AnthropicError } from "@anthropic-ai/sdk/core/error";
import type { AutoParseableOutputFormat } from "@anthropic-ai/sdk/lib/parser";

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

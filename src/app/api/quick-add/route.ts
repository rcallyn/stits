import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parsedItemOutputFormat } from "@/lib/quickAdd";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { text, now, history } = await req.json();

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const nowDate = typeof now === "string" ? now : new Date().toString();
  const pastTitles: string[] = Array.isArray(history)
    ? history.filter((title): title is string => typeof title === "string")
    : [];

  const historyClause = pastTitles.length
    ? ` The user has previously created these items: ${pastTitles
        .map((title) => `"${title}"`)
        .join(", ")}. If the new text describes the same recurring activity as one of these but leaves out a specific detail that item had (a place, brand, or person), include that same detail in the new title. If the new text already gives its own details, use those instead and don't mix in unrelated past details.`
    : "";

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: parsedItemOutputFormat(),
    },
    system: `You turn a short piece of natural language into either a calendar event or a todo item. The user's current local date/time is: ${nowDate}. Resolve relative dates ("tomorrow", "next Friday", "in two weeks") against that. If the text describes something happening at a specific time, classify it as an event. If it describes a task with no specific time (even if it has a deadline/date), classify it as a todo.${historyClause}`,
    messages: [{ role: "user", content: text }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return NextResponse.json(
      { error: "Could not parse that into an event or todo." },
      { status: 422 }
    );
  }

  return NextResponse.json({ item: response.parsed_output });
}

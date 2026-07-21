import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parsedItemOutputFormat } from "@/lib/quickAdd";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { text, now } = await req.json();

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const nowDate = typeof now === "string" ? now : new Date().toString();

  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: parsedItemOutputFormat(),
    },
    system: `You turn a short piece of natural language into either a calendar event or a todo item. The user's current local date/time is: ${nowDate}. Resolve relative dates ("tomorrow", "next Friday", "in two weeks") against that. If the text describes something happening at a specific time, classify it as an event. If it describes a task with no specific time (even if it has a deadline/date), classify it as a todo.`,
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

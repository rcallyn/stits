import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/apiValidation";
import { canvasSyncRequestSchema } from "@/lib/schemas";
import { CanvasSyncError, runCanvasSync } from "@/lib/canvasSync";

// The "Sync now" button. Saves the feed URL it was given and runs the same
// server-side sync the daily cron does (see lib/canvasSync.ts).
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, canvasSyncRequestSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await runCanvasSync(parsed.data.feedUrl);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof CanvasSyncError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

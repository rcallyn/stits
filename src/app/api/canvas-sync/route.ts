import { NextRequest, NextResponse } from "next/server";
import { parseIcs } from "@/lib/ics";

// Canvas's calendar feed doesn't send CORS headers for arbitrary browser
// origins, so this fetches and parses it server-side and hands back an
// already-normalized list.
export async function POST(req: NextRequest) {
  const { feedUrl } = await req.json();

  if (typeof feedUrl !== "string" || !feedUrl.trim()) {
    return NextResponse.json({ error: "Missing Canvas calendar feed URL." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(feedUrl.trim());
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }

  let text: string;
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      return NextResponse.json({ error: `Canvas returned an error (${res.status}).` }, { status: 502 });
    }
    text = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach that feed URL — check that it's correct." },
      { status: 502 }
    );
  }

  if (!text.includes("BEGIN:VCALENDAR")) {
    return NextResponse.json({ error: "That URL didn't return a calendar feed." }, { status: 502 });
  }

  const items = parseIcs(text);
  return NextResponse.json({ items });
}

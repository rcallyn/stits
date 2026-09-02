import { NextRequest, NextResponse } from "next/server";
import { parseIcs } from "@/lib/ics";
import { parseBody } from "@/lib/apiValidation";
import { canvasSyncRequestSchema } from "@/lib/schemas";

// Canvas's calendar feed doesn't send CORS headers for arbitrary browser
// origins, so this fetches and parses it server-side and hands back an
// already-normalized list.
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, canvasSyncRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { feedUrl } = parsed.data;

  let url: URL;
  try {
    url = new URL(feedUrl.trim());
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  // This endpoint does a server-side fetch of whatever URL is given to it,
  // so without a strict allowlist it's an open SSRF proxy (e.g. pointing it
  // at cloud metadata endpoints or internal services). Canvas calendar feeds
  // only ever live on an institution's *.instructure.com subdomain, so that
  // doubles as a tight allowlist for the feature's actual purpose.
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "instructure.com" && !host.endsWith(".instructure.com"))) {
    return NextResponse.json(
      { error: "Feed URL must be an https://*.instructure.com calendar link." },
      { status: 400 }
    );
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

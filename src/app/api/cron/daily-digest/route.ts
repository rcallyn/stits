import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { shiftISODate } from "@/lib/schedule";
import { formatMorningDigest, loadDayPlan } from "@/lib/digest";
import { sendPushoverNotification } from "@/lib/pushover";
import { runCanvasSync } from "@/lib/canvasSync";

// Vercel Cron jobs can only run at a fixed UTC time and Hobby-plan projects
// can't run more often than daily, so a single trigger can't stay pinned to
// 7am US Eastern across the DST boundary. vercel.json instead schedules this
// route twice a day (covering both EDT and EST), and this check makes only
// the one that actually lands on 7am ET do anything.
const TARGET_HOUR_ET = 7;

// Every user's Canvas sync and digest share one invocation.
export const maxDuration = 60;

function currentEasternHourAndDate(): { hour: number; isoDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // "24" is what this formatter uses for midnight instead of "00".
  const hour = Number(get("hour")) % 24;
  return { hour, isoDate: `${get("year")}-${get("month")}-${get("day")}` };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hour, isoDate: today } = currentEasternHourAndDate();
  if (hour !== TARGET_HOUR_ET) {
    return NextResponse.json({ skipped: true, reason: `hour ${hour} != ${TARGET_HOUR_ET}` });
  }

  const users = await sql<{ id: string; pushover_user_key: string | null; canvas_feed_url: string | null }[]>`
    select u.id, u.pushover_user_key, s.canvas_feed_url
    from users u left join settings s on s.user_id = u.id
    where u.status = 'active'
  `;

  const dayLabel = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Pull in new Canvas assignments first so today's digests include them.
  // The feeds are fetched concurrently so one slow feed can't use up the
  // whole invocation, and a feed problem shouldn't cost anyone's digest, so
  // a failure is only logged.
  await Promise.all(
    users
      .filter((u) => u.canvas_feed_url)
      .map((u) =>
        runCanvasSync(u.id).catch((err) => {
          console.error(`Daily Canvas sync failed for user ${u.id}:`, err);
        })
      )
  );

  let sent = 0;
  let failed = 0;
  for (const user of users) {
    if (!user.pushover_user_key) continue;
    try {
      const message = formatMorningDigest(await loadDayPlan(user.id, today, shiftISODate(today, 1)), today);
      const ok = await sendPushoverNotification(user.pushover_user_key, message, `stits — ${dayLabel}`);
      if (ok) sent++;
      else failed++;
    } catch (err) {
      failed++;
      console.error(`Daily digest failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ today, users: users.length, sent, failed });
}

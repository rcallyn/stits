import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { shiftISODate } from "@/lib/schedule";
import { formatEveningRecap, loadDayPlan } from "@/lib/digest";
import { sendPushoverNotification } from "@/lib/pushover";

// Like the morning digest, Vercel Cron only fires at fixed UTC times, so
// vercel.json schedules this twice (EDT and EST) and only the run that lands
// on 6pm US Eastern sends anything.
const TARGET_HOUR_ET = 18;

function easternNow(): { hour: number; minutes: number; isoDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // "24" is what this formatter uses for midnight instead of "00".
  const hour = Number(get("hour")) % 24;
  return { hour, minutes: hour * 60 + Number(get("minute")), isoDate: `${get("year")}-${get("month")}-${get("day")}` };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { hour, minutes, isoDate: today } = easternNow();
  if (hour !== TARGET_HOUR_ET) {
    return NextResponse.json({ skipped: true, reason: `hour ${hour} != ${TARGET_HOUR_ET}` });
  }

  const users = await sql<{ id: string; pushover_user_key: string }[]>`
    select id, pushover_user_key from users
    where status = 'active' and pushover_user_key is not null and pushover_user_key <> ''
  `;

  let sent = 0;
  let failed = 0;
  let quiet = 0;
  for (const user of users) {
    try {
      const plan = await loadDayPlan(user.id, today, shiftISODate(today, 1));
      const message = formatEveningRecap(plan, today, minutes);
      // Nothing left today: stay silent rather than push an empty recap.
      if (!message) {
        quiet++;
        continue;
      }
      const ok = await sendPushoverNotification(user.pushover_user_key, message, "stits — what's left today");
      if (ok) sent++;
      else failed++;
    } catch (err) {
      failed++;
      console.error(`Evening recap failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ today, users: users.length, sent, quiet, failed });
}

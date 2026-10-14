import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkCurrentPassword, requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/apiValidation";
import { accountPatchSchema } from "@/lib/schemas";
import { isValidPushoverUserKey } from "@/lib/pushover";

export type AccountPayload = { email: string; isAdmin: boolean; hasPushover: boolean };

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { email, isAdmin, hasPushover } = auth.user;
  return NextResponse.json({ email, isAdmin, hasPushover } satisfies AccountPayload);
}

// Saving a Pushover key turns on push 2FA at login and the 7am digest.
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, accountPatchSchema);
  if (!parsed.ok) return parsed.response;
  const { currentPassword, pushoverUserKey } = parsed.data;

  const denied = await checkCurrentPassword(req, auth.user, currentPassword);
  if (denied) return denied;

  if (pushoverUserKey && !(await isValidPushoverUserKey(pushoverUserKey))) {
    return NextResponse.json(
      { error: "Pushover didn't recognize that user key." },
      { status: 400 }
    );
  }
  await sql`update users set pushover_user_key = ${pushoverUserKey} where id = ${auth.user.id}`;
  const { email, isAdmin } = auth.user;
  return NextResponse.json({ email, isAdmin, hasPushover: pushoverUserKey !== null } satisfies AccountPayload);
}

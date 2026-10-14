import { after, NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth";
import { parseBody } from "@/lib/apiValidation";
import { signupSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { sendPushoverNotification } from "@/lib/pushover";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rateLimit";

// Public signup. New accounts start 'pending' and can't sign in until an
// admin approves them (Other → Users), so a stranger can't use the app — or
// its paid quick-add API — just by registering. Admins with Pushover set up
// get a push for each request.
//
// The reply is the same whether or not the email was already registered, so
// this can't be used to find out who has an account. The admin alert goes
// out after the response for the same reason: awaiting it would make new
// emails measurably slower to answer than existing ones.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { limited, retryAfterSeconds } = await isRateLimited("signup", ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many signups from this network. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }
  await recordAttempt("signup", ip);

  const parsed = await parseBody(req, signupSchema);
  if (!parsed.ok) return parsed.response;
  const email = normalizeEmail(parsed.data.email);

  const [created] = await sql<{ id: string }[]>`
    insert into users (email, password_hash)
    values (${email}, ${hashPassword(parsed.data.password)})
    on conflict (email) do nothing
    returning id
  `;

  if (created) {
    await sql`insert into settings (user_id) values (${created.id}) on conflict do nothing`;
    after(() => notifyAdmins(email));
  }

  return NextResponse.json({ ok: true });
}

async function notifyAdmins(email: string) {
  const admins = await sql<{ pushover_user_key: string }[]>`
    select pushover_user_key from users
    where is_admin and status = 'active' and pushover_user_key is not null
  `;
  await Promise.all(
    admins.map((a) =>
      sendPushoverNotification(
        a.pushover_user_key,
        `${email} asked for an account. Approve or reject it in stits under Other → Users.`,
        "stits signup"
      )
    )
  );
}

// Pushover delivers the login codes, the daily digest and signup alerts.
// The app token is shared; each user who wants pushes saves their own
// Pushover user key in their account settings.

const API = "https://api.pushover.net/1";

export async function sendPushoverNotification(
  userKey: string,
  message: string,
  title = "stits login"
): Promise<boolean> {
  const token = process.env.PUSHOVER_APP_TOKEN;
  if (!token || !userKey) return false;

  try {
    const res = await fetch(`${API}/messages.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, user: userKey, message, title, priority: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Saving a wrong key would lock the user out (login codes would go nowhere),
// so keys are checked with Pushover before they're stored.
export async function isValidPushoverUserKey(userKey: string): Promise<boolean> {
  const token = process.env.PUSHOVER_APP_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${API}/users/validate.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, user: userKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

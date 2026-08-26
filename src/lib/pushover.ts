export async function sendPushoverNotification(
  message: string,
  title = "stits login"
): Promise<boolean> {
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) return false;

  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, user, message, title, priority: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

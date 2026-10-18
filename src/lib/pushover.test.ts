import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidPushoverUserKey, sendPushoverNotification } from "@/lib/pushover";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("PUSHOVER_APP_TOKEN", "app-token");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendPushoverNotification", () => {
  it("posts the message with the app token, user key and default title", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(sendPushoverNotification("user-key", "code 123456")).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.pushover.net/1/messages.json");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      token: "app-token",
      user: "user-key",
      message: "code 123456",
      title: "stits login",
      priority: 1,
    });
  });

  it("uses a custom title when given", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await sendPushoverNotification("user-key", "hi", "Daily digest");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).title).toBe("Daily digest");
  });

  it("returns false without calling the API when the token or user key is missing", async () => {
    await expect(sendPushoverNotification("", "hi")).resolves.toBe(false);
    vi.stubEnv("PUSHOVER_APP_TOKEN", "");
    await expect(sendPushoverNotification("user-key", "hi")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false on a non-OK response or a network error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(sendPushoverNotification("user-key", "hi")).resolves.toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(sendPushoverNotification("user-key", "hi")).resolves.toBe(false);
  });
});

describe("isValidPushoverUserKey", () => {
  it("validates the key against the users/validate endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(isValidPushoverUserKey("user-key")).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.pushover.net/1/users/validate.json");
    expect(JSON.parse(init.body)).toEqual({ token: "app-token", user: "user-key" });
  });

  it("returns false when Pushover rejects the key or the request fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(isValidPushoverUserKey("bad")).resolves.toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(isValidPushoverUserKey("bad")).resolves.toBe(false);
  });

  it("returns false without calling the API when the app token is unset", async () => {
    vi.stubEnv("PUSHOVER_APP_TOKEN", "");
    await expect(isValidPushoverUserKey("user-key")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/rateLimit";

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("clientIp", () => {
  it("prefers the platform-set x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }))).toBe(
      "203.0.113.7"
    );
  });

  it("falls back to the last (trusted) x-forwarded-for hop, not the spoofable first", () => {
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("returns a constant when no IP header is present", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

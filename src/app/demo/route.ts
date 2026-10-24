import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE_NAME } from "@/lib/demo/demoMode";

// The public demo's entry point: turns on demo mode for this browser and
// opens the dashboard on the sample data (see lib/demo/demoFetch.ts).
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(DEMO_COOKIE_NAME, "1", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

import { ImageResponse } from "next/og";
import { appIconElement } from "@/lib/appIcon";

// 180x180 is Apple's recommended apple-touch-icon size (iPhone/iPad
// home-screen icon at the largest device scale factor Apple documents).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(appIconElement(size.width), { ...size });
}

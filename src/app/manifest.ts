import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "stits",
    short_name: "stits",
    description: "Schedule, todos, and everything else in one place.",
    start_url: "/",
    display: "standalone",
    // Splash-screen background — use the app's default (light) background.
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

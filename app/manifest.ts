import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pleasant Workforce",
    short_name: "Pleasant",
    description: "Shifts, timesheets and pay for healthcare agency workers.",
    start_url: "/workforce",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; "),
  },
];

const MARKETING_URL = "https://aultrum.co.uk/pleasant";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async redirects() {
    return [
      {
        source: "/shifts/requests",
        destination: "/dispatch?tab=requests",
        permanent: false,
      },
      // Pleasant's marketing pages live on the Aultrum site.
      { source: "/pricing", destination: `${MARKETING_URL}/pricing/`, permanent: false },
      // Assist moved under Persona; keep old links (emails, bookmarks) working.
      { source: "/assist", destination: "/persona/assist", permanent: false },
      { source: "/assist/:path*", destination: "/persona/assist/:path*", permanent: false },
      // The home page was Oversight; it's Qualifiers now.
      { source: "/oversight", destination: "/qualifiers", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

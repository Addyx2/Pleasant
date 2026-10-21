import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async redirects() {
    return [
      {
        source: "/shifts/requests",
        destination: "/dispatch?tab=requests",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

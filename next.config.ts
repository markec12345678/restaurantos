import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "standalone" removed - causes crashes with custom server.js in production
  // Custom server.js with WebSocket support needs standard Next.js build
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;

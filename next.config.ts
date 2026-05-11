import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // NOTE: "standalone" removed - causes crashes with custom server.js in production
  // Custom server.js with WebSocket support needs standard Next.js build
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  devIndicators: false,
};

export default withNextIntl(nextConfig);

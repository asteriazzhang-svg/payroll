import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node server mode (standalone): the app has a backend (Route Handlers +
  // Prisma), so it runs as a server. Standalone produces a self-contained
  // server bundle ideal for Docker.
  output: "standalone",
  images: {
    unoptimized: true,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

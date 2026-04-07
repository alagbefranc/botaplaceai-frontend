import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { hostname: "cdn.prod.website-files.com" },
      { hostname: "cdn.aidesigner.ai" },
    ],
  },
};

export default nextConfig;

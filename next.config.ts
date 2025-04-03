import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,  // This will disable ESLint checks during build
  },
  // Other config options here
};

export default nextConfig;
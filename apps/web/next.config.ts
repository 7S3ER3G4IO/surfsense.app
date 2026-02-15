import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      // Proxy API calls to the legacy backend (SurfSense API)
      {
        source: '/api/:path*',
        destination: process.env.LEGACY_API_URL 
          ? `${process.env.LEGACY_API_URL}/api/:path*` 
          : 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;

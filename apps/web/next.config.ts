import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      // Rewrite root to the static index.html from the legacy site
      {
        source: '/',
        destination: '/index.html',
      },
      // Proxy API calls to the legacy backend (SurfSense API)
      {
        source: '/api/:path*',
        destination: process.env.LEGACY_API_URL 
          ? `${process.env.LEGACY_API_URL}/api/:path*` 
          : 'http://localhost:3001/api/:path*',
      },
      // Proxy specific legacy routes if needed (e.g., /rss, /forecast)
      // Add more as discovered from server.js
    ];
  },
};

export default nextConfig;

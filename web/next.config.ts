import type { NextConfig } from "next";

const TRACE_API_PORT = process.env.TRACE_API_PORT || "8000";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Raise the request body size limit so large media uploads (e.g. a 9 MB MP4)
  // reach the stamp route instead of hitting Vercel's default 4.5 MB cap that
  // returns HTTP 413 "Payload Too Large". 50 MB covers the demo's stated
  // "under 100MB each" ceiling while staying within Vercel's max.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // In development: proxy /api/v1/* to the local FastAPI service (port 8000).
  // In production (Vercel): the Next.js API routes proxy to the public backend.
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }
    return [
      {
        source: "/api/v1/:path*",
        destination: `http://127.0.0.1:${TRACE_API_PORT}/v1/:path*`,
      },
      {
        source: "/api/card/:path*",
        destination: `http://127.0.0.1:${TRACE_API_PORT}/card/:path*`,
      },
    ];
  },
};

export default nextConfig;

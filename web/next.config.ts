import type { NextConfig } from "next";

const TRACE_API_PORT = process.env.TRACE_API_PORT || "8000";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Proxy /api/v1/* → the Trace FastAPI service (localhost:8000).
  // This keeps the browser on same-origin (no CORS, no absolute URLs) and
  // works identically in the sandbox (behind Caddy) and in local dev.
  async rewrites() {
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

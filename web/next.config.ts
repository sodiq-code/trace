import type { NextConfig } from "next";

const TRACE_API_PORT = process.env.TRACE_API_PORT || "8000";

const nextConfig: NextConfig = {
 typescript: {
  ignoreBuildErrors: true,
 },
 reactStrictMode: false,
 // Raise the body size limit (applies to Server Actions; Route Handlers use
 // the maxBodySize route segment config).
 experimental: {
  serverActions: {
   bodySizeLimit: "50mb",
  },
 },
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

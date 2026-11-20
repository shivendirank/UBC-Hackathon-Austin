import type { NextConfig } from "next";

const apiOrigin = (process.env.THIN_ICE_API_URL || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // One public site URL: browser calls /backend/* on Vercel; we proxy to the live API tunnel.
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: "/backend/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;

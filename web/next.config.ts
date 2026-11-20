import type { NextConfig } from "next";

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
  // /backend/* is handled by app/backend/[...path]/route.ts (adds ngrok skip headers).
  // Do not rewrite here — rewrites forward the browser User-Agent and ngrok returns HTML.
};

export default nextConfig;

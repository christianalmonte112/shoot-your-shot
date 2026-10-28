import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Recently visited screens stay mounted. The call page hangs up in its
  // effect cleanup so a hidden route does not keep the microphone open.
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
};

export default nextConfig;

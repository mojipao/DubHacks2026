import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@boh/shared"],
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

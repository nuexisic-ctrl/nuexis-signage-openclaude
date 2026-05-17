import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    serverActions: {
      allowedOrigins: ['10.0.2.2:3000', 'localhost:3000']
    }
  }
};

export default withSerwist(nextConfig);
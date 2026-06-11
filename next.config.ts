import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import os from "os";

// Helper to get local network IP addresses dynamically so Server Actions work on other devices
const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(`${net.address}:3000`);
        }
      }
    }
  }
  return ips;
};

// Helper to parse hosts from environment variables for production server actions
const getProductionAllowedOrigins = () => {
  const origins = new Set<string>();
  
  const addHost = (urlStr: string | undefined) => {
    if (!urlStr) return;
    try {
      // Add protocol if missing to make URL constructor happy
      const normalized = urlStr.includes('://') ? urlStr : `https://${urlStr}`;
      const url = new URL(normalized);
      origins.add(url.host);
    } catch (e) {
      // If parsing fails, just strip protocol and add direct string
      origins.add(urlStr.replace(/^https?:\/\//, ''));
    }
  };

  addHost(process.env.URL);
  addHost(process.env.DEPLOY_PRIME_URL);
  addHost(process.env.NEXT_PUBLIC_SITE_URL);
  
  return Array.from(origins);
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    serverActions: {
      allowedOrigins: process.env.NODE_ENV === 'development' 
        ? ['10.0.2.2:3000', 'localhost:3000', ...getLocalIPs()] 
        : getProductionAllowedOrigins()
    }
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ]
  }
};

export default withSerwist(nextConfig);
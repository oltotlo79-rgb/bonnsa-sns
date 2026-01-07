import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // 開発環境でのプライベートIP制限を回避
    unoptimized: process.env.NODE_ENV === 'development',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '550mb',
    },
  },
};

export default nextConfig;

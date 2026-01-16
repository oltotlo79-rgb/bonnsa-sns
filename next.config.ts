import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercelではstandalone出力は不要（Dockerを使う場合はコメントを解除）
  // output: 'standalone',

  images: {
    remotePatterns: [
      // Azure Blob Storage（後方互換性のため残す）
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
      },
      // Cloudflare R2
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      // Unsplash (ランディングページ用)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
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

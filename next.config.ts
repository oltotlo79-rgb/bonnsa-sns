import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker用のstandalone出力を有効化
  output: 'standalone',

  images: {
    remotePatterns: [
      // Azure Blob Storage
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
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

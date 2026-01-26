import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Docker/コンテナ環境ではstandalone出力を使用
  // Vercelでは自動的に無視される
  output: 'standalone',

  images: {
    remotePatterns: [
      // Azure Blob Storage（後方互換性のため残す）
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
      },
      // Cloudflare R2（パブリックバケット）
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      // Cloudflare R2（カスタムドメイン使用時）
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      // Supabase Storage
      {
        protocol: 'https',
        hostname: '*.supabase.co',
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

export default withSentryConfig(nextConfig, {
  // Sentry組織とプロジェクト設定（環境変数で上書き可能）
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // ソースマップのアップロード設定
  silent: !process.env.CI, // CI以外ではログを抑制
  widenClientFileUpload: true,

  // Next.js内部ファイル（ソースマップなし）の警告を抑制
  sourcemaps: {
    ignore: [
      '**/node_modules/**',
      '**/*_client-reference-manifest*',
      '**/*-manifest.js',  // 全てのmanifestファイルを除外
    ],
  },

  // パフォーマンス最適化
  tunnelRoute: '/monitoring', // Ad blockerを回避するトンネルルート
});

/**
 * @file app/layout.tsx
 * @description BON-LOGアプリケーションのルートレイアウト
 *
 * このファイルはNext.js App Routerのルートレイアウトとして機能し、
 * アプリケーション全体に共通する設定を定義します。
 *
 * 主な責務:
 * - HTMLドキュメントの基本構造（html, body タグ）
 * - Webフォントの設定（Noto Sans JP, Geist Mono, Shippori Mincho）
 * - 全体メタデータ（SEO、OGP、Twitter Cards）の設定
 * - 共通プロバイダー（状態管理、テーマ）のラップ
 * - Google AdSenseスクリプトの読み込み
 *
 * 注意:
 * - このレイアウトはServer Componentとして動作
 * - 全ページでこのレイアウトが適用される
 * - suppressHydrationWarningはテーマ切り替え時のハイドレーション警告を抑制
 */

// Next.jsのメタデータ型定義
import type { Metadata } from "next";
// Google Fontsからフォントを読み込むためのユーティリティ
// - Noto Sans JP: 日本語UIに最適化されたサンセリフフォント
// - Geist Mono: コード表示用の等幅フォント
// - Shippori Mincho: 和風デザインに適した明朝体フォント
import { Noto_Sans_JP, Geist_Mono, Shippori_Mincho } from "next/font/google";
// グローバルCSSスタイルシート
import "./globals.css";
// 共通プロバイダー（React Query, テーマ等）
import { Providers } from "./providers";
// Google AdSenseスクリプトコンポーネント
import { GoogleAdSense } from "@/components/ads";
// SEO用JSON-LD構造化データコンポーネント
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";

/**
 * Noto Sans JPフォントの設定
 * 日本語コンテンツのメインフォントとして使用
 */
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",  // CSS変数名
  subsets: ["latin"],                // サブセット（必須）
  weight: ["400", "500", "700"],     // 使用するウェイト（通常、中、太字）
});

/**
 * Geist Monoフォントの設定
 * コードスニペットや等幅テキストに使用
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",    // CSS変数名
  subsets: ["latin"],               // サブセット
});

/**
 * Shippori Minchoフォントの設定
 * 和風デザイン要素や見出しに使用する明朝体
 */
const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori-mincho",  // CSS変数名
  subsets: ["latin"],                   // サブセット
  weight: ["400", "500", "700"],        // 使用するウェイト
});

/**
 * ベースURLの取得
 * 環境変数から取得、未設定の場合は本番URLをデフォルトとして使用
 */
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

/**
 * アプリケーション全体のメタデータ設定
 *
 * SEO最適化とソーシャルメディア共有のための設定を含む:
 * - 基本的なtitle/description
 * - Open Graph（Facebook, LINE等）設定
 * - Twitter Cards設定
 * - 検索エンジンクローラー設定
 * - ファビコン/アイコン設定
 */
export const metadata: Metadata = {
  // ページタイトル設定（テンプレート機能付き）
  title: {
    default: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    template: '%s - BON-LOG',  // 子ページのtitleは「{ページ名} - BON-LOG」形式
  },
  // サイト説明
  description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。盆栽園マップ、イベント情報、コミュニティ機能を提供。',
  // 検索キーワード
  keywords: ['盆栽', 'SNS', 'コミュニティ', '盆栽園', 'イベント', '松柏', '雑木', '苔玉', '盆栽愛好家'],
  // 著者情報
  authors: [{ name: 'BON-LOG' }],
  creator: 'BON-LOG',
  publisher: 'BON-LOG',
  // メタデータのベースURL（相対パスの解決に使用）
  metadataBase: new URL(baseUrl),
  // 正規URL
  alternates: {
    canonical: '/',
  },
  // Open Graph設定（Facebook, LINE等での共有時に使用）
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: baseUrl,
    siteName: 'BON-LOG',
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。',
    images: [
      {
        url: '/api/og',  // 動的OG画像生成API
        width: 1200,
        height: 630,
        alt: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
      },
    ],
  },
  // Twitter Cards設定
  twitter: {
    card: 'summary_large_image',
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。',
    images: ['/api/og'],  // 動的OG画像生成API
  },
  // 検索エンジンクローラー設定
  robots: {
    index: true,    // インデックス許可
    follow: true,   // リンク追跡許可
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,       // 動画プレビュー制限なし
      'max-image-preview': 'large',  // 大きい画像プレビュー許可
      'max-snippet': -1,             // スニペット文字数制限なし
    },
  },
  // アイコン設定
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  // PWAマニフェスト
  manifest: '/site.webmanifest',
};

/**
 * ルートレイアウトコンポーネント
 *
 * アプリケーション全体の最上位レイアウトとして機能します。
 * 全ページに共通する要素（フォント、プロバイダー、広告スクリプト）を設定します。
 *
 * @param children - 子ページ/レイアウトのコンテンツ
 * @returns HTML文書全体の構造
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang属性で日本語を指定
    // suppressHydrationWarningはテーマ切り替え時のハイドレーション警告を抑制
    <html lang="ja" suppressHydrationWarning>
      <body
        // CSS変数として各フォントを設定し、font-sansをデフォルトに
        // antialiasedでフォントのアンチエイリアスを有効化
        className={`${notoSansJP.variable} ${geistMono.variable} ${shipporiMincho.variable} font-sans antialiased`}
      >
        {/* SEO: 組織情報の構造化データ（ナレッジパネル用） */}
        <OrganizationJsonLd
          name="BON-LOG"
          url={baseUrl}
          logo={`${baseUrl}/logo.png`}
          description="盆栽愛好家のためのコミュニティSNS"
        />
        {/* SEO: ウェブサイト情報の構造化データ（サイトリンク検索ボックス用） */}
        <WebSiteJsonLd
          name="BON-LOG"
          url={baseUrl}
          description="盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。"
          searchUrl={`${baseUrl}/search?q=`}
        />
        {/* 共通プロバイダーで子コンポーネントをラップ */}
        <Providers>{children}</Providers>
        {/* Google AdSenseスクリプト */}
        <GoogleAdSense />
      </body>
    </html>
  );
}

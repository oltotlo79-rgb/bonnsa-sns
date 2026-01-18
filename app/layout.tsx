import type { Metadata } from "next";
import { Noto_Sans_JP, Geist_Mono, Shippori_Mincho } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Sentryクライアント初期化（本番環境でエラー監視）
import "../sentry.client.config";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori-mincho",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'

export const metadata: Metadata = {
  title: {
    default: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    template: '%s - BON-LOG',
  },
  description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。盆栽園マップ、イベント情報、コミュニティ機能を提供。',
  keywords: ['盆栽', 'SNS', 'コミュニティ', '盆栽園', 'イベント', '松柏', '雑木', '苔玉', '盆栽愛好家'],
  authors: [{ name: 'BON-LOG' }],
  creator: 'BON-LOG',
  publisher: 'BON-LOG',
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: baseUrl,
    siteName: 'BON-LOG',
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${notoSansJP.variable} ${geistMono.variable} ${shipporiMincho.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

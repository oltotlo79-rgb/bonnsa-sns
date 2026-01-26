/**
 * @file app/api/og/route.tsx
 * @description 動的OG画像生成API
 *
 * このAPIは、SNSでシェアされた際に表示されるOG画像を動的に生成します。
 * Next.jsのImageResponse（@vercel/og）を使用して、
 * サーバーサイドでPNG画像をレンダリングします。
 *
 * @features
 * - デフォルトOG画像の生成（タイトルなし）
 * - カスタムタイトル付きOG画像の生成
 * - 和風デザイン（緑と茶色のグラデーション）
 * - 盆栽アイコン付き
 *
 * @usage
 * - デフォルト: /api/og
 * - カスタム: /api/og?title=投稿タイトル
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/image-response
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

/**
 * Edge Runtimeで実行（高速なレスポンスのため）
 */
export const runtime = 'edge'

/**
 * OG画像のサイズ（Open Graph推奨サイズ）
 */
const size = {
  width: 1200,
  height: 630,
}

/**
 * OG画像を生成するGETハンドラー
 *
 * クエリパラメータ:
 * - title: 画像に表示するタイトル（オプション）
 *
 * @param request - Next.jsのリクエストオブジェクト
 * @returns ImageResponse - 生成されたPNG画像
 */
export async function GET(request: NextRequest) {
  // URLからクエリパラメータを取得
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')

  // ImageResponseを使用してOG画像を生成
  // JSX要素をPNG画像としてレンダリング
  return new ImageResponse(
    (
      <div
        style={{
          // 全体のスタイル
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          // 和風グラデーション背景（深緑から茶色）
          background: 'linear-gradient(135deg, #1a472a 0%, #2d5016 50%, #4a3728 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 装飾的な円形パターン（和風モチーフ） */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '60px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '80px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
          }}
        />

        {/* メインコンテンツエリア */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
            maxWidth: '1000px',
          }}
        >
          {/* 盆栽アイコン（絵文字） */}
          <div
            style={{
              fontSize: '80px',
              marginBottom: '24px',
              display: 'flex',
            }}
          >
            🌳
          </div>

          {/* サイト名 */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: '16px',
              letterSpacing: '0.05em',
              display: 'flex',
            }}
          >
            BON-LOG
          </div>

          {/* タイトルがある場合は表示、なければキャッチコピー */}
          {title ? (
            <div
              style={{
                fontSize: '36px',
                color: '#e8e8e8',
                textAlign: 'center',
                lineHeight: 1.4,
                maxWidth: '800px',
                display: 'flex',
              }}
            >
              {title.length > 60 ? title.substring(0, 60) + '...' : title}
            </div>
          ) : (
            <div
              style={{
                fontSize: '32px',
                color: '#d4d4d4',
                display: 'flex',
              }}
            >
              盆栽愛好家のためのコミュニティSNS
            </div>
          )}
        </div>

        {/* フッターライン */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '2px',
              background: 'rgba(255, 255, 255, 0.3)',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: '18px',
              color: 'rgba(255, 255, 255, 0.6)',
              display: 'flex',
            }}
          >
            bon-log.com
          </div>
          <div
            style={{
              width: '60px',
              height: '2px',
              background: 'rgba(255, 255, 255, 0.3)',
              display: 'flex',
            }}
          />
        </div>
      </div>
    ),
    {
      // 画像サイズを指定
      ...size,
    }
  )
}

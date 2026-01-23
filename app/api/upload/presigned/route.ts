/**
 * Presigned URL API
 *
 * Cloudflare R2への直接アップロード用の署名付きURLを生成します。
 * Vercelの4.5MBペイロード制限を回避して大きなファイル（動画など）をアップロードできます。
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

// 動画の最大ファイルサイズ（256MB）
const MAX_VIDEO_SIZE = 256 * 1024 * 1024

// 許可するMIMEタイプ
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
]

/**
 * MIMEタイプから拡張子を取得
 */
function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
  }
  return map[contentType] || '.mp4'
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { contentType, fileSize, folder = 'posts' } = body

    // バリデーション
    if (!contentType || !fileSize) {
      return NextResponse.json(
        { error: 'contentType と fileSize が必要です' },
        { status: 400 }
      )
    }

    // MIMEタイプチェック
    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: '許可されていないファイル形式です' },
        { status: 400 }
      )
    }

    // ファイルサイズチェック
    if (fileSize > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: `動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください` },
        { status: 400 }
      )
    }

    // R2設定の確認
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucket = process.env.R2_BUCKET_NAME || 'uploads'
    const publicUrl = process.env.R2_PUBLIC_URL

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: 'ストレージが設定されていません' },
        { status: 500 }
      )
    }

    // AWS SDK動的インポート
    const { S3Client } = await import('@aws-sdk/client-s3')
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

    // S3クライアント作成
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })

    // ユニークなファイル名を生成
    const ext = getExtension(contentType)
    const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

    // PutObjectコマンド作成
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueName,
      ContentType: contentType,
      ContentLength: fileSize,
    })

    // 署名付きURLを生成（有効期限: 1時間）
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    // 公開URL生成
    const fileUrl = publicUrl
      ? `${publicUrl}/${uniqueName}`
      : `https://${bucket}.${accountId}.r2.dev/${uniqueName}`

    return NextResponse.json({
      presignedUrl,
      fileUrl,
      key: uniqueName,
    })
  } catch (error) {
    console.error('Presigned URL generation error:', error)
    return NextResponse.json(
      { error: '署名付きURLの生成に失敗しました' },
      { status: 500 }
    )
  }
}

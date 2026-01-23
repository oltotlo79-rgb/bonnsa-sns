import { auth } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { NextRequest, NextResponse } from 'next/server'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'

// 動画の最大ファイルサイズ（50MB - モバイル向けに制限）
const MAX_VIDEO_SIZE = 50 * 1024 * 1024
// 画像の最大ファイルサイズ（5MB）
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // レート制限チェック（1分あたり5回）
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'upload')
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'アップロードが多すぎます。しばらく待ってから再試行してください' },
        { status: 429 }
      )
    }

    // 日次制限チェック（1日50回）
    const dailyLimitResult = await checkDailyLimit(session.user.id, 'upload')
    if (!dailyLimitResult.allowed) {
      return NextResponse.json(
        { error: `1日のアップロード上限（${dailyLimitResult.limit}回）に達しました` },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 })
    }

    // ファイルタイプのチェック
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')

    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: '画像または動画ファイルを選択してください' },
        { status: 400 }
      )
    }

    // ファイルサイズチェック
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / 1024 / 1024
      return NextResponse.json(
        { error: isVideo ? `動画は${maxSizeMB}MB以下にしてください` : `画像は${maxSizeMB}MB以下にしてください` },
        { status: 400 }
      )
    }

    // ファイルをBufferに変換
    const buffer = Buffer.from(await file.arrayBuffer())
    const folder = isVideo ? 'post-videos' : 'post-images'

    // ストレージにアップロード
    const result = await uploadFile(buffer, file.name, file.type, folder)

    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: result.error || 'アップロードに失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      type: isVideo ? 'video' : 'image',
    })
  } catch (error) {
    console.error('Media upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Error: ' + message }, { status: 500 })
  }
}

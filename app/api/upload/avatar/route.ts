import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは5MB以下にしてください' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPEG、PNG、WebP形式のみ対応しています' }, { status: 400 })
    }

    // TODO: Azure Blob Storageへのアップロード実装
    // 現在は仮のURLを返す
    const placeholderUrl = `/placeholder-avatar.png?userId=${session.user.id}&t=${Date.now()}`

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        avatarUrl: placeholderUrl,
      },
    })

    revalidatePath('/users/' + session.user.id)
    revalidatePath('/settings/profile')

    return NextResponse.json({
      success: true,
      url: placeholderUrl,
      message: '画像アップロード機能は現在準備中です'
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Error: ' + message }, { status: 500 })
  }
}

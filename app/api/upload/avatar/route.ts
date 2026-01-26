import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { uploadFile, deleteFile } from '@/lib/storage'
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

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは4MB以下にしてください' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPEG、PNG、WebP形式のみ対応しています' }, { status: 400 })
    }

    // 現在のユーザー情報を取得（古い画像を削除するため）
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    })

    // ファイルをBufferに変換
    const buffer = Buffer.from(await file.arrayBuffer())

    // ストレージにアップロード
    const result = await uploadFile(buffer, file.name, file.type, 'avatars')

    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: result.error || 'アップロードに失敗しました' },
        { status: 500 }
      )
    }

    // DBを更新
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        avatarUrl: result.url,
      },
    })

    // 古い画像を削除（ローカルまたはAzureのファイル）
    if (currentUser?.avatarUrl && !currentUser.avatarUrl.includes('placeholder')) {
      await deleteFile(currentUser.avatarUrl).catch((err: unknown) => {
        console.warn('Failed to delete old avatar:', err)
      })
    }

    revalidatePath('/users/' + session.user.id)
    revalidatePath('/settings/profile')

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Error: ' + message }, { status: 500 })
  }
}

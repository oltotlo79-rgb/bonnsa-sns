import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    console.log('Header upload started')
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: '認証エラー: ' + authError.message }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    console.log('User authenticated:', user.id)

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 })
    }
    console.log('File received:', file.name, file.size, file.type)

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズは5MB以下にしてください' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPEG、PNG、WebP形式のみ対応しています' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()
    const fileName = user.id + '/header.' + ext
    console.log('Uploading to:', fileName)

    await supabase.storage.from('headers').remove([
      user.id + '/header.jpeg',
      user.id + '/header.png',
      user.id + '/header.webp'
    ])

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    console.log('Starting upload to Supabase Storage...')
    const { error: uploadError } = await supabase.storage
      .from('headers')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Header upload error:', uploadError)
      return NextResponse.json({
        error: 'Upload failed: ' + uploadError.message
      }, { status: 500 })
    }
    console.log('Upload successful')

    const { data: { publicUrl } } = supabase.storage
      .from('headers')
      .getPublicUrl(fileName)
    console.log('Public URL:', publicUrl)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        header_url: publicUrl + '?t=' + Date.now(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
    }

    revalidatePath('/users/' + user.id)
    revalidatePath('/settings/profile')

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error) {
    console.error('Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Error: ' + message }, { status: 500 })
  }
}

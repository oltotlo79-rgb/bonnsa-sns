'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
  nickname: z.string().min(1, 'ニックネームは必須です').max(50, 'ニックネームは50文字以内で入力してください'),
  bio: z.string().max(200, '自己紹介は200文字以内で入力してください').optional(),
  location: z.string().max(100, '居住地域は100文字以内で入力してください').optional(),
})

export async function getUser(userId: string) {
  const supabase = await createClient()

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      *,
      posts:posts(count),
      followers:follows!follows_following_id_fkey(count),
      following:follows!follows_follower_id_fkey(count)
    `)
    .eq('id', userId)
    .single()

  if (error || !user) {
    return { error: 'ユーザーが見つかりません' }
  }

  return { user }
}

export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return { error: '認証が必要です' }
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (error || !user) {
    return { error: 'ユーザー情報の取得に失敗しました' }
  }

  return { user }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const result = profileSchema.safeParse({
    nickname: formData.get('nickname'),
    bio: formData.get('bio') || '',
    location: formData.get('location') || '',
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { error } = await supabase
    .from('users')
    .update({
      nickname: result.data.nickname,
      bio: result.data.bio,
      location: result.data.location,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'プロフィールの更新に失敗しました' }
  }

  revalidatePath(`/users/${user.id}`)
  revalidatePath('/settings/profile')
  return { success: true }
}

export async function updatePrivacy(isPublic: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const { error } = await supabase
    .from('users')
    .update({
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: '設定の更新に失敗しました' }
  }

  revalidatePath(`/users/${user.id}`)
  revalidatePath('/settings/account')
  return { success: true }
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'ファイルサイズは5MB以下にしてください' }
  }

  // MIMEタイプチェック
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'JPEG、PNG、WebP形式のみ対応しています' }
  }

  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/avatar.${ext}`

  // 古いファイルを削除
  await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpeg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`])

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    return { error: '画像のアップロードに失敗しました' }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName)

  // プロフィール更新
  const { error: updateError } = await supabase
    .from('users')
    .update({
      avatar_url: `${publicUrl}?t=${Date.now()}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    return { error: 'プロフィールの更新に失敗しました' }
  }

  revalidatePath(`/users/${user.id}`)
  revalidatePath('/settings/profile')
  return { success: true, url: publicUrl }
}

export async function uploadHeader(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ファイルサイズチェック（5MB）
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'ファイルサイズは5MB以下にしてください' }
  }

  // MIMEタイプチェック
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'JPEG、PNG、WebP形式のみ対応しています' }
  }

  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/header.${ext}`

  // 古いファイルを削除
  await supabase.storage.from('headers').remove([`${user.id}/header.jpeg`, `${user.id}/header.png`, `${user.id}/header.webp`])

  const { error: uploadError } = await supabase.storage
    .from('headers')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    return { error: '画像のアップロードに失敗しました' }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('headers')
    .getPublicUrl(fileName)

  // プロフィール更新
  const { error: updateError } = await supabase
    .from('users')
    .update({
      header_url: `${publicUrl}?t=${Date.now()}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    return { error: 'プロフィールの更新に失敗しました' }
  }

  revalidatePath(`/users/${user.id}`)
  revalidatePath('/settings/profile')
  return { success: true, url: publicUrl }
}

export async function deleteAccount() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // auth.usersから削除（カスケードで関連データも削除される）
  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    return { error: 'アカウントの削除に失敗しました' }
  }

  return { success: true }
}

export async function getFollowers(userId: string, cursor?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('follows')
    .select(`
      follower:users!follows_follower_id_fkey(id, nickname, avatar_url, bio)
    `)
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    return { error: 'フォロワーの取得に失敗しました' }
  }

  return { followers: data?.map(d => d.follower) || [] }
}

export async function getFollowing(userId: string, cursor?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('follows')
    .select(`
      following:users!follows_following_id_fkey(id, nickname, avatar_url, bio)
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    return { error: 'フォロー中ユーザーの取得に失敗しました' }
  }

  return { following: data?.map(d => d.following) || [] }
}

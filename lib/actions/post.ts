'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createPostSchema = z.object({
  content: z.string().max(500, '投稿は500文字以内で入力してください').optional(),
  genreIds: z.array(z.string()).max(3, 'ジャンルは3つまで選択できます'),
})

export async function createPost(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string
  const genreIds = formData.getAll('genreIds') as string[]
  const mediaUrls = formData.getAll('mediaUrls') as string[]
  const mediaType = formData.get('mediaType') as string | null

  // バリデーション
  if (!content && mediaUrls.length === 0) {
    return { error: 'テキストまたはメディアを入力してください' }
  }

  const result = createPostSchema.safeParse({ content, genreIds })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  // 投稿制限チェック（1日20件）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today.toISOString())

  if (count && count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  // 投稿作成
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content: content || null,
    })
    .select()
    .single()

  if (error || !post) {
    return { error: '投稿に失敗しました' }
  }

  // メディア追加
  if (mediaUrls.length > 0) {
    const mediaInserts = mediaUrls.map((url, index) => ({
      post_id: post.id,
      url,
      type: mediaType || 'image',
      sort_order: index,
    }))

    await supabase.from('post_media').insert(mediaInserts)
  }

  // ジャンル紐付け
  if (genreIds.length > 0) {
    const genreInserts = genreIds.map(genreId => ({
      post_id: post.id,
      genre_id: genreId,
    }))

    await supabase.from('post_genres').insert(genreInserts)
  }

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function createQuotePost(formData: FormData, quotePostId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const content = formData.get('content') as string

  if (!content) {
    return { error: '引用コメントを入力してください' }
  }

  if (content.length > 500) {
    return { error: '投稿は500文字以内で入力してください' }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today.toISOString())

  if (count && count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      content,
      quote_post_id: quotePostId,
    })
    .select()
    .single()

  if (error || !post) {
    return { error: '引用投稿に失敗しました' }
  }

  revalidatePath('/feed')
  return { success: true, postId: post.id }
}

export async function createRepost(postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 既にリポスト済みかチェック
  const { data: existing } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', user.id)
    .eq('repost_post_id', postId)
    .single()

  if (existing) {
    // リポスト解除
    await supabase.from('posts').delete().eq('id', existing.id)
    revalidatePath('/feed')
    return { success: true, reposted: false }
  }

  // 投稿制限チェック
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today.toISOString())

  if (count && count >= 20) {
    return { error: '1日の投稿上限（20件）に達しました' }
  }

  const { error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      repost_post_id: postId,
    })

  if (error) {
    return { error: 'リポストに失敗しました' }
  }

  revalidatePath('/feed')
  return { success: true, reposted: true }
}

export async function deletePost(postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 投稿の所有者確認
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (!post || post.user_id !== user.id) {
    return { error: '削除権限がありません' }
  }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) {
    return { error: '削除に失敗しました' }
  }

  revalidatePath('/feed')
  return { success: true }
}

export async function getPost(postId: string) {
  const supabase = await createClient()

  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(id, nickname, avatar_url),
      media:post_media(id, url, type, sort_order),
      genres:post_genres(genre:genres(id, name, category)),
      likes(count),
      comments(count),
      quote_post:posts!posts_quote_post_id_fkey(
        id,
        content,
        created_at,
        user:users(id, nickname, avatar_url)
      ),
      repost_post:posts!posts_repost_post_id_fkey(
        id,
        content,
        created_at,
        user:users(id, nickname, avatar_url),
        media:post_media(id, url, type, sort_order)
      )
    `)
    .eq('id', postId)
    .single()

  if (error || !post) {
    return { error: '投稿が見つかりません' }
  }

  return { post }
}

export async function getPosts(cursor?: string, limit = 20) {
  const supabase = await createClient()

  let query = supabase
    .from('posts')
    .select(`
      *,
      user:users(id, nickname, avatar_url),
      media:post_media(id, url, type, sort_order),
      genres:post_genres(genre:genres(id, name, category)),
      likes(count),
      comments(count),
      quote_post:posts!posts_quote_post_id_fkey(
        id,
        content,
        created_at,
        user:users(id, nickname, avatar_url)
      ),
      repost_post:posts!posts_repost_post_id_fkey(
        id,
        content,
        created_at,
        user:users(id, nickname, avatar_url),
        media:post_media(id, url, type, sort_order)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: posts, error } = await query

  if (error) {
    return { error: '投稿の取得に失敗しました' }
  }

  return { posts: posts || [] }
}

export async function getGenres() {
  const supabase = await createClient()

  const { data: genres, error } = await supabase
    .from('genres')
    .select('*')
    .order('category')
    .order('sort_order')

  if (error) {
    return { error: 'ジャンルの取得に失敗しました' }
  }

  // カテゴリごとにグループ化
  const grouped = genres?.reduce((acc, genre) => {
    if (!acc[genre.category]) {
      acc[genre.category] = []
    }
    acc[genre.category].push(genre)
    return acc
  }, {} as Record<string, typeof genres>)

  return { genres: grouped || {} }
}

export async function uploadPostMedia(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return { error: '画像または動画ファイルを選択してください' }
  }

  // ファイルサイズチェック
  const maxSize = isVideo ? 512 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxSize) {
    return { error: isVideo ? '動画は512MB以下にしてください' : '画像は5MB以下にしてください' }
  }

  const bucket = isVideo ? 'post-videos' : 'post-images'
  const ext = file.name.split('.').pop()
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return { error: 'アップロードに失敗しました' }
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName)

  return {
    success: true,
    url: publicUrl,
    type: isVideo ? 'video' : 'image'
  }
}

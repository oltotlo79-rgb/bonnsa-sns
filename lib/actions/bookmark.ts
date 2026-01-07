'use server'

import { createClient } from '@/lib/supabase/server'

// ブックマークトグル
export async function toggleBookmark(postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 現在のブックマーク状態を確認
  const { data: existingBookmark } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single()

  if (existingBookmark) {
    // ブックマーク解除
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', existingBookmark.id)

    if (error) {
      console.error('Remove bookmark error:', error)
      return { error: 'ブックマーク解除に失敗しました' }
    }

    return { success: true, bookmarked: false }
  } else {
    // ブックマーク追加
    const { error } = await supabase
      .from('bookmarks')
      .insert({
        post_id: postId,
        user_id: user.id,
      })

    if (error) {
      console.error('Add bookmark error:', error)
      return { error: 'ブックマークに失敗しました' }
    }

    return { success: true, bookmarked: true }
  }
}

// ブックマーク状態取得
export async function getBookmarkStatus(postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { bookmarked: false }
  }

  const { data: existingBookmark } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .single()

  return { bookmarked: !!existingBookmark }
}

// ブックマーク一覧取得
export async function getBookmarkedPosts(cursor?: string, limit = 20) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です', posts: [] }
  }

  let query = supabase
    .from('bookmarks')
    .select(`
      id,
      created_at,
      post:posts(
        id,
        content,
        created_at,
        user:users(id, nickname, avatar_url),
        media:post_media(id, url, type, order),
        genres:post_genres(genre:genres(id, name)),
        likes:likes(count),
        comments:comments(count),
        reposts:posts!original_post_id(count)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: bookmarks, error } = await query

  if (error) {
    console.error('Get bookmarked posts error:', error)
    return { error: 'ブックマークの取得に失敗しました', posts: [] }
  }

  const posts = bookmarks
    .filter(bookmark => bookmark.post)
    .map(bookmark => ({
      ...bookmark.post,
      likeCount: bookmark.post?.likes?.[0]?.count || 0,
      commentCount: bookmark.post?.comments?.[0]?.count || 0,
      repostCount: bookmark.post?.reposts?.[0]?.count || 0,
      genres: bookmark.post?.genres?.map(g => g.genre) || [],
    }))

  const hasMore = bookmarks.length === limit

  return {
    posts,
    nextCursor: hasMore ? bookmarks[bookmarks.length - 1]?.created_at : undefined,
  }
}

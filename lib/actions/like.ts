'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 投稿いいねトグル
export async function togglePostLike(postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 現在のいいね状態を確認
  const { data: existingLike } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .is('comment_id', null)
    .single()

  if (existingLike) {
    // いいね解除
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('id', existingLike.id)

    if (error) {
      console.error('Unlike error:', error)
      return { error: 'いいね解除に失敗しました' }
    }

    return { success: true, liked: false }
  } else {
    // いいね追加
    const { error } = await supabase
      .from('likes')
      .insert({
        post_id: postId,
        user_id: user.id,
      })

    if (error) {
      console.error('Like error:', error)
      return { error: 'いいねに失敗しました' }
    }

    // 通知作成（投稿者へ）
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (post && post.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: user.id,
        type: 'like',
        post_id: postId,
      })
    }

    return { success: true, liked: true }
  }
}

// コメントいいねトグル
export async function toggleCommentLike(commentId: string, postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 現在のいいね状態を確認
  const { data: existingLike } = await supabase
    .from('likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single()

  if (existingLike) {
    // いいね解除
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('id', existingLike.id)

    if (error) {
      console.error('Unlike comment error:', error)
      return { error: 'いいね解除に失敗しました' }
    }

    return { success: true, liked: false }
  } else {
    // いいね追加
    const { error } = await supabase
      .from('likes')
      .insert({
        comment_id: commentId,
        post_id: postId,
        user_id: user.id,
      })

    if (error) {
      console.error('Like comment error:', error)
      return { error: 'いいねに失敗しました' }
    }

    // 通知作成（コメント投稿者へ）
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single()

    if (comment && comment.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: comment.user_id,
        actor_id: user.id,
        type: 'comment_like',
        post_id: postId,
        comment_id: commentId,
      })
    }

    return { success: true, liked: true }
  }
}

// 投稿いいね状態取得
export async function getPostLikeStatus(postId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { liked: false }
  }

  const { data: existingLike } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .is('comment_id', null)
    .single()

  return { liked: !!existingLike }
}

// いいねした投稿一覧
export async function getLikedPosts(userId: string, cursor?: string, limit = 20) {
  const supabase = await createClient()

  let query = supabase
    .from('likes')
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
    .eq('user_id', userId)
    .not('post_id', 'is', null)
    .is('comment_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: likes, error } = await query

  if (error) {
    console.error('Get liked posts error:', error)
    return { error: 'いいねした投稿の取得に失敗しました', posts: [] }
  }

  const posts = likes
    .filter(like => like.post)
    .map(like => ({
      ...like.post,
      likeCount: like.post?.likes?.[0]?.count || 0,
      commentCount: like.post?.comments?.[0]?.count || 0,
      repostCount: like.post?.reposts?.[0]?.count || 0,
      genres: like.post?.genres?.map(g => g.genre) || [],
    }))

  const hasMore = likes.length === limit

  return {
    posts,
    nextCursor: hasMore ? likes[likes.length - 1]?.created_at : undefined,
  }
}

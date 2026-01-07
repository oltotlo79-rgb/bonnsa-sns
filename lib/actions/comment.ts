'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// コメント作成
export async function createComment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const postId = formData.get('postId') as string
  const parentId = formData.get('parentId') as string | null
  const content = formData.get('content') as string

  // バリデーション
  if (!content || content.trim().length === 0) {
    return { error: 'コメント内容を入力してください' }
  }

  if (content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  // コメント制限チェック（1日100件）
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)

  if (count && count >= 100) {
    return { error: '1日のコメント上限（100件）に達しました' }
  }

  // コメント作成
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: user.id,
      parent_id: parentId || null,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('Comment creation error:', error)
    return { error: 'コメントに失敗しました' }
  }

  // 通知作成
  if (parentId) {
    // 返信の場合：親コメントの投稿者へ通知
    const { data: parentComment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', parentId)
      .single()

    if (parentComment && parentComment.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: parentComment.user_id,
        actor_id: user.id,
        type: 'reply',
        post_id: postId,
        comment_id: comment.id,
      })
    }
  } else {
    // 通常コメントの場合：投稿者へ通知
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (post && post.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: user.id,
        type: 'comment',
        post_id: postId,
        comment_id: comment.id,
      })
    }
  }

  revalidatePath(`/posts/${postId}`)
  return { success: true, comment }
}

// コメント削除
export async function deleteComment(commentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // コメント取得して所有者確認
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('user_id, post_id')
    .eq('id', commentId)
    .single()

  if (fetchError || !comment) {
    return { error: 'コメントが見つかりません' }
  }

  if (comment.user_id !== user.id) {
    return { error: '削除権限がありません' }
  }

  // 子コメント（返信）も含めて削除
  const { error } = await supabase
    .from('comments')
    .delete()
    .or(`id.eq.${commentId},parent_id.eq.${commentId}`)

  if (error) {
    console.error('Comment deletion error:', error)
    return { error: 'コメントの削除に失敗しました' }
  }

  revalidatePath(`/posts/${comment.post_id}`)
  return { success: true }
}

// 投稿のコメント取得
export async function getComments(postId: string, cursor?: string, limit = 20) {
  const supabase = await createClient()

  let query = supabase
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      parent_id,
      user:users(id, nickname, avatar_url),
      likes:likes(count),
      replies:comments(count)
    `)
    .eq('post_id', postId)
    .is('parent_id', null) // 親コメントのみ
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: comments, error } = await query

  if (error) {
    console.error('Get comments error:', error)
    return { error: 'コメントの取得に失敗しました', comments: [] }
  }

  // 次ページがあるか確認
  const hasMore = comments.length === limit

  return {
    comments: comments.map(comment => ({
      ...comment,
      likeCount: comment.likes?.[0]?.count || 0,
      replyCount: comment.replies?.[0]?.count || 0,
    })),
    nextCursor: hasMore ? comments[comments.length - 1]?.created_at : undefined,
  }
}

// コメントへの返信取得
export async function getReplies(commentId: string, cursor?: string, limit = 10) {
  const supabase = await createClient()

  let query = supabase
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      parent_id,
      user:users(id, nickname, avatar_url),
      likes:likes(count)
    `)
    .eq('parent_id', commentId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (cursor) {
    query = query.gt('created_at', cursor)
  }

  const { data: replies, error } = await query

  if (error) {
    console.error('Get replies error:', error)
    return { error: '返信の取得に失敗しました', replies: [] }
  }

  const hasMore = replies.length === limit

  return {
    replies: replies.map(reply => ({
      ...reply,
      likeCount: reply.likes?.[0]?.count || 0,
    })),
    nextCursor: hasMore ? replies[replies.length - 1]?.created_at : undefined,
  }
}

// コメント数取得
export async function getCommentCount(postId: string) {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  if (error) {
    return { count: 0 }
  }

  return { count: count || 0 }
}

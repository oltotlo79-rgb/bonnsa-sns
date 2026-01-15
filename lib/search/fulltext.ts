import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * PostgreSQL全文検索ユーティリティ
 *
 * 注意: このファイルはServer Actions ('use server') から呼び出されるユーティリティです。
 * 直接クライアントから呼び出すことはできません。
 *
 * 対応する検索方式:
 * - pg_bigm: 2-gramベース、日本語に最適（拡張機能のインストールが必要）
 * - pg_trgm: 3-gramベース、多くの環境で利用可能
 * - LIKE: フォールバック用、部分一致検索
 *
 * 環境変数 SEARCH_MODE で切り替え可能:
 * - 'bigm': pg_bigmを使用
 * - 'trgm': pg_trgmを使用
 * - 'like': LIKE検索を使用（デフォルト）
 */

export type SearchMode = 'bigm' | 'trgm' | 'like'

// 検索モードを取得
export function getSearchMode(): SearchMode {
  const mode = process.env.SEARCH_MODE?.toLowerCase()
  if (mode === 'bigm' || mode === 'trgm') {
    return mode
  }
  return 'like' // デフォルト
}

// 拡張機能が利用可能かチェック
export async function checkExtensionAvailable(extension: 'pg_bigm' | 'pg_trgm'): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ available: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = ${extension}
      ) as available
    `
    return result[0]?.available ?? false
  } catch {
    return false
  }
}

// 拡張機能を有効化（管理者権限が必要な場合あり）
export async function enableExtension(extension: 'pg_bigm' | 'pg_trgm'): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "${extension}"`)
    return true
  } catch (error) {
    console.error(`Failed to enable ${extension}:`, error)
    return false
  }
}

// GINインデックスを作成
export async function createSearchIndexes(): Promise<{ success: boolean; message: string }> {
  const mode = getSearchMode()

  try {
    if (mode === 'bigm') {
      // pg_bigm用インデックス
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS posts_content_bigm_idx
        ON posts USING gin (content gin_bigm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_nickname_bigm_idx
        ON users USING gin (nickname gin_bigm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_bio_bigm_idx
        ON users USING gin (bio gin_bigm_ops)
      `
      return { success: true, message: 'pg_bigmインデックスを作成しました' }
    } else if (mode === 'trgm') {
      // pg_trgm用インデックス
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS posts_content_trgm_idx
        ON posts USING gin (content gin_trgm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_nickname_trgm_idx
        ON users USING gin (nickname gin_trgm_ops)
      `
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS users_bio_trgm_idx
        ON users USING gin (bio gin_trgm_ops)
      `
      return { success: true, message: 'pg_trgmインデックスを作成しました' }
    }
    return { success: true, message: 'LIKE検索モード（インデックス不要）' }
  } catch (error) {
    console.error('Failed to create search indexes:', error)
    return { success: false, message: `インデックス作成に失敗: ${error}` }
  }
}

/**
 * 全文検索クエリを実行（投稿検索）
 */
export async function fulltextSearchPosts(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], genreIds = [], cursor, limit = 20 } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') {
    return []
  }

  const escapedQuery = query.replace(/'/g, "''")

  try {
    let postIds: { id: string }[]

    if (mode === 'bigm') {
      // pg_bigm検索 (likequery関数を使用)
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.content LIKE '%' || ${escapedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${genreIds.length > 0 ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        ` : Prisma.empty}
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      // pg_trgm検索 (類似度を使用)
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.content % ${escapedQuery} OR p.content ILIKE '%' || ${escapedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${genreIds.length > 0 ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        ` : Prisma.empty}
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY similarity(p.content, ${escapedQuery}) DESC, p.created_at DESC
        LIMIT ${limit}
      `
    } else {
      // LIKE検索 (フォールバック)
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.content ILIKE '%' || ${escapedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${genreIds.length > 0 ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        ` : Prisma.empty}
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    }

    return postIds.map(p => p.id)
  } catch (error) {
    console.error('Fulltext search error:', error)
    // エラー時はLIKE検索にフォールバック
    return fulltextSearchPostsWithLike(query, options)
  }
}

// LIKE検索へのフォールバック
async function fulltextSearchPostsWithLike(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], genreIds = [], cursor, limit = 20 } = options
  const escapedQuery = query.replace(/'/g, "''")

  const postIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM posts p
    WHERE p.content ILIKE '%' || ${escapedQuery} || '%'
    ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${genreIds.length > 0 ? Prisma.sql`
      AND EXISTS (
        SELECT 1 FROM post_genres pg
        WHERE pg.post_id = p.id
        AND pg.genre_id IN (${Prisma.join(genreIds)})
      )
    ` : Prisma.empty}
    ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `

  return postIds.map(p => p.id)
}

/**
 * 全文検索クエリを実行（ユーザー検索）
 */
export async function fulltextSearchUsers(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], currentUserId, cursor, limit = 20 } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') {
    return []
  }

  const escapedQuery = query.replace(/'/g, "''")

  try {
    let userIds: { id: string }[]

    if (mode === 'bigm') {
      // pg_bigm検索
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname LIKE '%' || ${escapedQuery} || '%' OR u.bio LIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      // pg_trgm検索 (類似度を使用)
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname % ${escapedQuery} OR u.nickname ILIKE '%' || ${escapedQuery} || '%'
               OR u.bio % ${escapedQuery} OR u.bio ILIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        ORDER BY GREATEST(
          similarity(u.nickname, ${escapedQuery}),
          COALESCE(similarity(u.bio, ${escapedQuery}), 0)
        ) DESC
        LIMIT ${limit}
      `
    } else {
      // LIKE検索 (フォールバック)
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname ILIKE '%' || ${escapedQuery} || '%' OR u.bio ILIKE '%' || ${escapedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        LIMIT ${limit}
      `
    }

    return userIds.map(u => u.id)
  } catch (error) {
    console.error('Fulltext user search error:', error)
    // エラー時はLIKE検索にフォールバック
    return fulltextSearchUsersWithLike(query, options)
  }
}

// LIKE検索へのフォールバック
async function fulltextSearchUsersWithLike(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    cursor?: string
    limit?: number
  } = {}
): Promise<string[]> {
  const { excludedUserIds = [], currentUserId, cursor, limit = 20 } = options
  const escapedQuery = query.replace(/'/g, "''")

  const userIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM users u
    WHERE (u.nickname ILIKE '%' || ${escapedQuery} || '%' OR u.bio ILIKE '%' || ${escapedQuery} || '%')
    ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
    ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
    LIMIT ${limit}
  `

  return userIds.map(u => u.id)
}

/**
 * 検索モードの状態を取得
 */
export async function getSearchStatus(): Promise<{
  mode: SearchMode
  bigmAvailable: boolean
  trgmAvailable: boolean
}> {
  const mode = getSearchMode()
  const [bigmAvailable, trgmAvailable] = await Promise.all([
    checkExtensionAvailable('pg_bigm'),
    checkExtensionAvailable('pg_trgm'),
  ])

  return { mode, bigmAvailable, trgmAvailable }
}

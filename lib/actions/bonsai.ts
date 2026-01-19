/**
 * 盆栽管理機能のServer Actions
 *
 * このファイルは、ユーザーの盆栽コレクション管理に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - 盆栽一覧の取得
 * - 盆栽詳細の取得
 * - 盆栽の登録・更新・削除
 * - 成長記録の追加・更新・削除
 * - 盆栽タイムラインの取得
 *
 * ## 盆栽管理とは
 * ユーザーが所有する盆栽を登録し、
 * 成長記録（写真・メモ）を時系列で管理する機能です。
 *
 * ## データ構造
 * - Bonsai: 盆栽本体（名前、樹種、入手日など）
 * - BonsaiRecord: 成長記録（日付、内容、画像）
 * - BonsaiRecordImage: 記録に添付された画像
 *
 * @module lib/actions/bonsai
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * Next.jsのキャッシュ再検証関数
 * 盆栽登録・更新後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * レート制限関数
 * 検索はDB負荷が高いため、レート制限を適用
 */
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { headers } from 'next/headers'

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * Server ActionsでクライアントIPを取得
 * headers()を使用してリクエストヘッダーからIPアドレスを取得
 */
async function getClientIpFromHeaders(): Promise<string> {
  const headersList = await headers()
  const cfIp = headersList.get('cf-connecting-ip')
  if (cfIp) return cfIp
  const xForwardedFor = headersList.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()
  const xRealIp = headersList.get('x-real-ip')
  if (xRealIp) return xRealIp
  return 'unknown'
}

// ============================================================
// 盆栽一覧取得
// ============================================================

/**
 * 盆栽一覧を取得
 *
 * ## 機能概要
 * 指定されたユーザーの盆栽一覧を取得します。
 * ユーザーIDを省略した場合は現在のユーザーの盆栽を取得。
 *
 * ## 取得内容
 * - 盆栽基本情報
 * - 最新の成長記録（1件）
 * - 最新記録のサムネイル画像（1枚）
 * - 記録件数
 *
 * @param userId - 対象のユーザーID（省略可）
 * @returns 盆栽一覧、または { error: string }
 *
 * @example
 * ```typescript
 * // 自分の盆栽一覧
 * const { bonsais } = await getBonsais()
 *
 * // 他ユーザーの盆栽一覧
 * const { bonsais } = await getBonsais('user-123')
 * ```
 */
export async function getBonsais(userId?: string) {
  // ------------------------------------------------------------
  // ユーザーID決定
  // ------------------------------------------------------------

  const session = await auth()

  /**
   * 引数で指定されたユーザーID、なければセッションのユーザーID
   */
  const targetUserId = userId || session?.user?.id

  if (!targetUserId) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 盆栽一覧を取得
    // ------------------------------------------------------------

    const bonsais = await prisma.bonsai.findMany({
      where: { userId: targetUserId },
      include: {
        /**
         * 最新の成長記録を1件取得
         *
         * recordAt の降順で並べて take: 1
         */
        records: {
          orderBy: { recordAt: 'desc' },
          take: 1,
          include: {
            /**
             * 記録のサムネイル画像（1枚目）
             */
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
        /**
         * 成長記録の総件数
         */
        _count: { select: { records: true } },
      },
      /**
       * 登録日時の新しい順
       */
      orderBy: { createdAt: 'desc' },
    })

    return { bonsais }
  } catch (error) {
    logger.error('Get bonsais error:', error)
    return { error: '盆栽一覧の取得に失敗しました' }
  }
}

// ============================================================
// 盆栽詳細取得
// ============================================================

/**
 * 盆栽詳細を取得
 *
 * ## 機能概要
 * 指定された盆栽IDの詳細情報を取得します。
 *
 * ## 取得内容
 * - 盆栽基本情報（名前、樹種、入手日、説明）
 * - 所有者情報
 * - 全成長記録（画像含む）
 * - 記録件数
 *
 * @param bonsaiId - 盆栽ID
 * @returns 盆栽詳細、または { error: string }
 *
 * @example
 * ```typescript
 * const { bonsai } = await getBonsai('bonsai-123')
 *
 * console.log(`${bonsai.name}（${bonsai.species}）`)
 * console.log(`記録数: ${bonsai._count.records}件`)
 * ```
 */
export async function getBonsai(bonsaiId: string) {
  try {
    // ------------------------------------------------------------
    // 盆栽詳細を取得
    // ------------------------------------------------------------

    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      include: {
        /**
         * 所有者情報
         */
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
        /**
         * 全成長記録（新しい順）
         */
        records: {
          orderBy: { recordAt: 'desc' },
          include: {
            /**
             * 各記録の画像
             */
            images: { orderBy: { sortOrder: 'asc' } },
          },
        },
        /**
         * 記録件数
         */
        _count: { select: { records: true } },
      },
    })

    if (!bonsai) {
      return { error: '盆栽が見つかりません' }
    }

    return { bonsai }
  } catch (error) {
    logger.error('Get bonsai error:', error)
    return { error: '盆栽の取得に失敗しました' }
  }
}

// ============================================================
// 盆栽登録
// ============================================================

/**
 * 盆栽を登録
 *
 * ## 機能概要
 * 新しい盆栽をコレクションに追加します。
 *
 * ## 登録項目
 * - name: 盆栽の名前（必須）
 * - species: 樹種（任意）
 * - acquiredAt: 入手日（任意）
 * - description: 説明（任意）
 *
 * @param data - 盆栽データ
 * @returns 作成された盆栽、または { error: string }
 *
 * @example
 * ```typescript
 * const result = await createBonsai({
 *   name: '黒松 銘「雲龍」',
 *   species: '黒松',
 *   acquiredAt: new Date('2020-04-01'),
 *   description: '師匠から譲り受けた樹齢50年の逸品',
 * })
 * ```
 */
export async function createBonsai(data: {
  name: string
  species?: string
  acquiredAt?: Date
  description?: string
}) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 盆栽を作成
    // ------------------------------------------------------------

    const bonsai = await prisma.bonsai.create({
      data: {
        userId: session.user.id,
        name: data.name,
        species: data.species,
        acquiredAt: data.acquiredAt,
        description: data.description,
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath('/bonsai')
    return { bonsai }
  } catch (error) {
    logger.error('Create bonsai error:', error)
    return { error: '盆栽の登録に失敗しました' }
  }
}

// ============================================================
// 盆栽更新
// ============================================================

/**
 * 盆栽を更新
 *
 * ## 機能概要
 * 既存の盆栽情報を更新します。
 *
 * ## 所有者チェック
 * 自分の盆栽のみ更新可能
 *
 * @param bonsaiId - 盆栽ID
 * @param data - 更新データ
 * @returns 更新された盆栽、または { error: string }
 *
 * @example
 * ```typescript
 * const result = await updateBonsai('bonsai-123', {
 *   name: '黒松 銘「雲龍」（改）',
 *   description: '2024年に植え替え実施',
 * })
 * ```
 */
export async function updateBonsai(
  bonsaiId: string,
  data: {
    name?: string
    species?: string
    acquiredAt?: Date | null
    description?: string
  }
) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 所有者確認
    // ------------------------------------------------------------

    /**
     * 自分の盆栽かどうかを確認
     *
     * userId と session.user.id が一致するか
     */
    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId: session.user.id },
    })

    if (!existing) {
      return { error: '盆栽が見つかりません' }
    }

    // ------------------------------------------------------------
    // 盆栽を更新
    // ------------------------------------------------------------

    const bonsai = await prisma.bonsai.update({
      where: { id: bonsaiId },
      data: {
        name: data.name,
        species: data.species,
        acquiredAt: data.acquiredAt,
        description: data.description,
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath(`/bonsai/${bonsaiId}`)
    return { bonsai }
  } catch (error) {
    logger.error('Update bonsai error:', error)
    return { error: '盆栽の更新に失敗しました' }
  }
}

// ============================================================
// 盆栽削除
// ============================================================

/**
 * 盆栽を削除
 *
 * ## 機能概要
 * 盆栽をコレクションから削除します。
 *
 * ## カスケード削除
 * 盆栽に関連する成長記録・画像も自動削除
 *
 * ## 所有者チェック
 * 自分の盆栽のみ削除可能
 *
 * @param bonsaiId - 盆栽ID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteBonsai('bonsai-123')
 *
 * if (result.success) {
 *   toast.success('盆栽を削除しました')
 * }
 * ```
 */
export async function deleteBonsai(bonsaiId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 所有者確認
    // ------------------------------------------------------------

    const existing = await prisma.bonsai.findFirst({
      where: { id: bonsaiId, userId: session.user.id },
    })

    if (!existing) {
      return { error: '盆栽が見つかりません' }
    }

    // ------------------------------------------------------------
    // 盆栽を削除
    // ------------------------------------------------------------

    /**
     * Prismaのカスケード削除により、
     * 関連する BonsaiRecord と BonsaiRecordImage も自動削除
     */
    await prisma.bonsai.delete({ where: { id: bonsaiId } })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath('/bonsai')
    return { success: true }
  } catch (error) {
    logger.error('Delete bonsai error:', error)
    return { error: '盆栽の削除に失敗しました' }
  }
}

// ============================================================
// 成長記録追加
// ============================================================

/**
 * 成長記録を追加
 *
 * ## 機能概要
 * 盆栽に新しい成長記録を追加します。
 *
 * ## 記録内容
 * - content: 記録テキスト
 * - recordAt: 記録日時
 * - imageUrls: 添付画像のURL配列
 *
 * ## 所有者チェック
 * 自分の盆栽にのみ記録を追加可能
 *
 * @param data - 記録データ
 * @returns 作成された記録、または { error: string }
 *
 * @example
 * ```typescript
 * const result = await addBonsaiRecord({
 *   bonsaiId: 'bonsai-123',
 *   content: '春の植え替えを実施。根の状態良好。',
 *   recordAt: new Date(),
 *   imageUrls: ['/uploads/photo1.jpg', '/uploads/photo2.jpg'],
 * })
 * ```
 */
export async function addBonsaiRecord(data: {
  bonsaiId: string
  content?: string
  recordAt?: Date
  imageUrls?: string[]
}) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 盆栽の所有者確認
    // ------------------------------------------------------------

    const bonsai = await prisma.bonsai.findFirst({
      where: { id: data.bonsaiId, userId: session.user.id },
    })

    if (!bonsai) {
      return { error: '盆栽が見つかりません' }
    }

    // ------------------------------------------------------------
    // 成長記録を作成
    // ------------------------------------------------------------

    /**
     * ネストした create で画像も同時作成
     */
    const record = await prisma.bonsaiRecord.create({
      data: {
        bonsaiId: data.bonsaiId,
        content: data.content,
        /**
         * recordAt が指定されていなければ現在日時
         */
        recordAt: data.recordAt || new Date(),
        /**
         * 画像がある場合はネストして作成
         */
        images: data.imageUrls?.length
          ? {
              create: data.imageUrls.map((url: string, index: number) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath(`/bonsai/${data.bonsaiId}`)
    return { record }
  } catch (error) {
    logger.error('Add bonsai record error:', error)
    return { error: '成長記録の追加に失敗しました' }
  }
}

// ============================================================
// 成長記録更新
// ============================================================

/**
 * 成長記録を更新
 *
 * ## 機能概要
 * 既存の成長記録を更新します。
 *
 * ## 画像の更新
 * 画像URLが指定された場合、既存の画像を削除して新規作成
 *
 * ## 所有者チェック
 * 自分の盆栽の記録のみ更新可能
 *
 * @param recordId - 記録ID
 * @param data - 更新データ
 * @returns 更新された記録、または { error: string }
 *
 * @example
 * ```typescript
 * const result = await updateBonsaiRecord('record-123', {
 *   content: '植え替え後の様子。新芽が出始めた。',
 *   imageUrls: ['/uploads/new-photo.jpg'],
 * })
 * ```
 */
export async function updateBonsaiRecord(
  recordId: string,
  data: {
    content?: string
    recordAt?: Date
    imageUrls?: string[]
  }
) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 記録の所有者確認
    // ------------------------------------------------------------

    /**
     * 記録を取得し、関連する盆栽の所有者を確認
     */
    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      include: { bonsai: true },
    })

    if (!existing || existing.bonsai.userId !== session.user.id) {
      return { error: '成長記録が見つかりません' }
    }

    // ------------------------------------------------------------
    // 画像を削除して再作成
    // ------------------------------------------------------------

    /**
     * imageUrls が指定された場合は既存画像を全削除
     */
    if (data.imageUrls !== undefined) {
      await prisma.bonsaiRecordImage.deleteMany({ where: { recordId } })
    }

    // ------------------------------------------------------------
    // 記録を更新
    // ------------------------------------------------------------

    const record = await prisma.bonsaiRecord.update({
      where: { id: recordId },
      data: {
        content: data.content,
        recordAt: data.recordAt,
        /**
         * 新しい画像を作成
         */
        images: data.imageUrls?.length
          ? {
              create: data.imageUrls.map((url: string, index: number) => ({
                url,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath(`/bonsai/${existing.bonsaiId}`)
    return { record }
  } catch (error) {
    logger.error('Update bonsai record error:', error)
    return { error: '成長記録の更新に失敗しました' }
  }
}

// ============================================================
// 成長記録削除
// ============================================================

/**
 * 成長記録を削除
 *
 * ## 機能概要
 * 成長記録を削除します。
 *
 * ## カスケード削除
 * 記録に関連する画像も自動削除
 *
 * ## 所有者チェック
 * 自分の盆栽の記録のみ削除可能
 *
 * @param recordId - 記録ID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteBonsaiRecord('record-123')
 *
 * if (result.success) {
 *   toast.success('記録を削除しました')
 * }
 * ```
 */
export async function deleteBonsaiRecord(recordId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  try {
    // ------------------------------------------------------------
    // 記録の所有者確認
    // ------------------------------------------------------------

    const existing = await prisma.bonsaiRecord.findFirst({
      where: { id: recordId },
      include: { bonsai: true },
    })

    if (!existing || existing.bonsai.userId !== session.user.id) {
      return { error: '成長記録が見つかりません' }
    }

    // ------------------------------------------------------------
    // 記録を削除
    // ------------------------------------------------------------

    /**
     * カスケード削除で BonsaiRecordImage も自動削除
     */
    await prisma.bonsaiRecord.delete({ where: { id: recordId } })

    // ------------------------------------------------------------
    // キャッシュ再検証と結果返却
    // ------------------------------------------------------------

    revalidatePath(`/bonsai/${existing.bonsaiId}`)
    return { success: true }
  } catch (error) {
    logger.error('Delete bonsai record error:', error)
    return { error: '成長記録の削除に失敗しました' }
  }
}

// ============================================================
// 盆栽タイムライン取得
// ============================================================

/**
 * 盆栽タイムラインを取得
 *
 * ## 機能概要
 * 全ユーザーの盆栽の最新成長記録をタイムライン形式で取得します。
 *
 * ## 用途
 * - 「盆栽ギャラリー」のようなフィードページ
 * - 他のユーザーの盆栽を発見
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param options - オプション（cursor, limit）
 * @returns 記録一覧と次のカーソル
 *
 * @example
 * ```typescript
 * // タイムライン取得
 * const { records, nextCursor } = await getBonsaiTimeline({ limit: 20 })
 *
 * // 追加読み込み
 * const more = await getBonsaiTimeline({ cursor: nextCursor })
 * ```
 */
export async function getBonsaiTimeline(options: { cursor?: string; limit?: number } = {}) {
  const { cursor, limit = 20 } = options

  try {
    // ------------------------------------------------------------
    // 成長記録を取得
    // ------------------------------------------------------------

    const records = await prisma.bonsaiRecord.findMany({
      take: limit,
      /**
       * カーソルベースページネーション
       */
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      /**
       * 記録日時の新しい順
       */
      orderBy: { recordAt: 'desc' },
      include: {
        /**
         * 盆栽情報と所有者情報
         */
        bonsai: {
          include: {
            user: {
              select: { id: true, nickname: true, avatarUrl: true },
            },
          },
        },
        /**
         * 記録の画像
         */
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    const hasMore = records.length === limit
    const nextCursor = hasMore ? records[records.length - 1]?.id : undefined

    return { records, nextCursor }
  } catch (error) {
    logger.error('Get bonsai timeline error:', error)
    return { records: [], nextCursor: undefined }
  }
}

// ============================================================
// 特定盆栽の成長記録一覧取得
// ============================================================

/**
 * 特定の盆栽の成長記録一覧を取得
 *
 * ## 機能概要
 * 指定された盆栽の成長記録を時系列で取得します。
 *
 * ## 用途
 * - 盆栽詳細ページの記録一覧
 * - 成長の履歴確認
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param bonsaiId - 盆栽ID
 * @param options - オプション（cursor, limit）
 * @returns 記録一覧と次のカーソル
 *
 * @example
 * ```typescript
 * const { records, nextCursor } = await getBonsaiRecords('bonsai-123', { limit: 10 })
 * ```
 */
export async function getBonsaiRecords(
  bonsaiId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const { cursor, limit = 20 } = options

  try {
    // ------------------------------------------------------------
    // 成長記録を取得
    // ------------------------------------------------------------

    const records = await prisma.bonsaiRecord.findMany({
      where: { bonsaiId },
      take: limit,
      /**
       * カーソルベースページネーション
       */
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      /**
       * 記録日時の新しい順
       */
      orderBy: { recordAt: 'desc' },
      include: {
        /**
         * 記録の画像
         */
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    // ------------------------------------------------------------
    // 結果の整形と返却
    // ------------------------------------------------------------

    const hasMore = records.length === limit
    const nextCursor = hasMore ? records[records.length - 1]?.id : undefined

    return { records, nextCursor }
  } catch (error) {
    logger.error('Get bonsai records error:', error)
    return { records: [], nextCursor: undefined }
  }
}

// ============================================================
// 盆栽検索
// ============================================================

/**
 * 盆栽を検索
 *
 * ## 機能概要
 * 現在のユーザーの盆栽をキーワードで検索します。
 *
 * ## 検索対象
 * - 盆栽の名前（name）
 * - 樹種（species）
 * - 説明（description）
 *
 * ## セキュリティ
 * - 自分の盆栽のみ検索可能
 * - レート制限あり（1分20回）
 *
 * @param query - 検索キーワード
 * @returns 検索結果の盆栽一覧、または { error: string }
 *
 * @example
 * ```typescript
 * const { bonsais } = await searchBonsais('黒松')
 * ```
 */
export async function searchBonsais(query: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // レート制限チェック（IP単位）
  // ------------------------------------------------------------
  const clientIp = await getClientIpFromHeaders()
  const rateLimitResult = await rateLimit(`search:bonsai:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return {
      bonsais: [],
      error: '検索リクエストが多すぎます。しばらく待ってから再試行してください',
    }
  }

  // ------------------------------------------------------------
  // 入力バリデーション
  // ------------------------------------------------------------
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    // 空のクエリの場合は全件返す
    return getBonsais()
  }

  // クエリが長すぎる場合は拒否
  if (trimmedQuery.length > 100) {
    return { bonsais: [], error: '検索キーワードが長すぎます' }
  }

  try {
    // ------------------------------------------------------------
    // 盆栽を検索
    // ------------------------------------------------------------

    const bonsais = await prisma.bonsai.findMany({
      where: {
        userId: session.user.id,
        OR: [
          {
            name: {
              contains: trimmedQuery,
              mode: 'insensitive',
            },
          },
          {
            species: {
              contains: trimmedQuery,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: trimmedQuery,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        records: {
          orderBy: { recordAt: 'desc' },
          take: 1,
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { bonsais }
  } catch (error) {
    logger.error('Search bonsais error:', error)
    return { error: '盆栽の検索に失敗しました' }
  }
}

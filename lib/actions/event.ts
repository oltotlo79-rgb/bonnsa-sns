/**
 * イベント機能のServer Actions
 *
 * このファイルは、盆栽関連イベントの管理に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - イベント一覧の取得（フィルター付き）
 * - 今後のイベント取得
 * - 月別イベント取得（カレンダー用）
 * - イベント詳細の取得
 * - イベントの作成・更新・削除
 *
 * ## イベントとは
 * 盆栽展示会、即売会、ワークショップなど
 * 盆栽に関連するイベント情報を管理します。
 *
 * ## フィルター機能
 * - 地域（関東、関西など）
 * - 都道府県
 * - 過去イベントの表示/非表示
 * - 月別表示
 *
 * @module lib/actions/event
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * Next.jsのキャッシュ再検証関数
 * イベント作成・更新・削除後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * 都道府県関連のユーティリティ
 * 地域から都道府県のリストを取得するために使用
 */
import { getPrefecturesByRegion, type Region } from '@/lib/constants/prefectures'

// ============================================================
// イベント一覧取得
// ============================================================

/**
 * イベント一覧を取得
 *
 * ## 機能概要
 * 様々なフィルター条件でイベント一覧を取得します。
 *
 * ## フィルターオプション
 * - region: 地域（関東、関西など）
 * - prefecture: 都道府県
 * - showPast: 過去イベントを表示するか
 * - month/year: 特定の月のイベントのみ
 *
 * ## 優先順位
 * prefecture > region
 * （都道府県が指定されていれば地域は無視）
 *
 * @param options - フィルターオプション
 * @returns イベント一覧
 *
 * @example
 * ```typescript
 * // 関東地域のイベント
 * const { events } = await getEvents({ region: '関東' })
 *
 * // 過去イベントも含む
 * const { events } = await getEvents({ showPast: true })
 *
 * // 2024年4月のイベント
 * const { events } = await getEvents({ year: 2024, month: 3 })
 * ```
 */
export async function getEvents(options?: {
  region?: string
  prefecture?: string
  showPast?: boolean
  month?: number
  year?: number
}) {
  // ------------------------------------------------------------
  // オプションの展開
  // ------------------------------------------------------------

  const { region, prefecture, showPast = false, month, year } = options || {}

  /**
   * 今日の日付を取得
   * 時刻を0時0分0秒に設定して日付のみで比較
   */
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ------------------------------------------------------------
  // 地域フィルターの構築
  // ------------------------------------------------------------

  /**
   * 都道府県のフィルター配列
   *
   * 優先順位:
   * 1. prefecture が指定されていればそれを使用
   * 2. region が指定されていれば、その地域の都道府県リストを取得
   */
  let prefectureFilter: string[] | undefined
  if (prefecture) {
    prefectureFilter = [prefecture]
  } else if (region) {
    /**
     * getPrefecturesByRegion で地域から都道府県リストを取得
     * 例: '関東' → ['東京都', '神奈川県', '埼玉県', ...]
     */
    prefectureFilter = getPrefecturesByRegion(region as Region)
  }

  // ------------------------------------------------------------
  // 日付フィルターの構築
  // ------------------------------------------------------------

  /**
   * 日付範囲のフィルター
   */
  let dateFilter: { gte?: Date; lt?: Date } | undefined
  if (month !== undefined && year !== undefined) {
    /**
     * 月が指定されている場合は、その月の範囲を設定
     *
     * 注意: JavaScriptのDateは月が0始まり
     */
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 1)
    dateFilter = {
      gte: startOfMonth,  // 月の初日以降
      lt: endOfMonth,     // 翌月の初日未満
    }
  } else if (!showPast) {
    /**
     * 過去イベントを非表示の場合は、今日以降のみ
     */
    dateFilter = { gte: today }
  }

  // ------------------------------------------------------------
  // イベントを取得
  // ------------------------------------------------------------

  const events = await prisma.event.findMany({
    where: {
      /**
       * 非表示イベントを除外
       */
      isHidden: false,
      /**
       * 日付フィルター（設定されている場合）
       *
       * スプレッド演算子で条件付きプロパティを追加
       */
      ...(dateFilter && { startDate: dateFilter }),
      /**
       * 都道府県フィルター（設定されている場合）
       *
       * in: 配列のいずれかにマッチ
       */
      ...(prefectureFilter && { prefecture: { in: prefectureFilter } }),
    },
    include: {
      /**
       * イベント作成者の情報を含める
       */
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    /**
     * 開始日の昇順（近いイベントから順に）
     */
    orderBy: { startDate: 'asc' },
  })

  return { events }
}

// ============================================================
// 今後のイベント取得
// ============================================================

/**
 * 今後のイベントを取得
 *
 * ## 機能概要
 * 今日以降のイベントを取得します。
 * サイドバーやトップページでの表示用です。
 *
 * ## 用途
 * - サイドバーの「今後のイベント」セクション
 * - ホームページのイベント一覧
 *
 * @param limit - 取得件数（デフォルト: 10）
 * @param region - 地域フィルター（オプション）
 * @returns イベント一覧
 *
 * @example
 * ```typescript
 * // 直近5件
 * const { events } = await getUpcomingEvents(5)
 *
 * // 関東地域の直近10件
 * const { events } = await getUpcomingEvents(10, '関東')
 * ```
 */
export async function getUpcomingEvents(limit = 10, region?: string) {
  // ------------------------------------------------------------
  // 今日の日付を取得
  // ------------------------------------------------------------

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ------------------------------------------------------------
  // 地域フィルター
  // ------------------------------------------------------------

  /**
   * 地域が指定されている場合は都道府県リストを取得
   */
  const prefectures = region ? getPrefecturesByRegion(region as Region) : undefined

  // ------------------------------------------------------------
  // イベントを取得
  // ------------------------------------------------------------

  const events = await prisma.event.findMany({
    where: {
      isHidden: false,
      /**
       * 今日以降のイベントのみ
       */
      startDate: { gte: today },
      /**
       * 地域フィルター（設定されている場合）
       */
      ...(prefectures && { prefecture: { in: prefectures } }),
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    /**
     * 開始日の昇順（近いイベントから順に）
     */
    orderBy: { startDate: 'asc' },
    /**
     * 件数制限
     */
    take: limit,
  })

  return { events }
}

// ============================================================
// 月別イベント取得（カレンダー用）
// ============================================================

/**
 * 月別イベントを取得（カレンダー用）
 *
 * ## 機能概要
 * 特定の月に関連するイベントを取得します。
 * カレンダー表示で使用します。
 *
 * ## 取得条件
 * 以下のいずれかを満たすイベント:
 * 1. 開始日が指定月内
 * 2. 終了日が指定月内
 * 3. 開始日が月前、終了日が月後（月をまたぐイベント）
 *
 * @param year - 年
 * @param month - 月（0始まり: 0=1月, 11=12月）
 * @returns イベント一覧
 *
 * @example
 * ```typescript
 * // 2024年4月のイベント
 * const { events } = await getEventsByMonth(2024, 3)  // 月は0始まり
 * ```
 */
export async function getEventsByMonth(year: number, month: number) {
  // ------------------------------------------------------------
  // 月の範囲を計算
  // ------------------------------------------------------------

  /**
   * 月の初日と翌月の初日を計算
   */
  const startOfMonth = new Date(year, month, 1)
  const endOfMonth = new Date(year, month + 1, 1)

  // ------------------------------------------------------------
  // イベントを取得
  // ------------------------------------------------------------

  const events = await prisma.event.findMany({
    where: {
      isHidden: false,
      /**
       * OR条件: 以下のいずれかを満たす
       */
      OR: [
        /**
         * ケース1: 開始日が月内
         */
        {
          startDate: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
        /**
         * ケース2: 終了日が月内
         */
        {
          endDate: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
        /**
         * ケース3: イベントが月をまたぐ
         * （開始が月より前、終了が月より後）
         */
        {
          startDate: { lt: startOfMonth },
          endDate: { gte: endOfMonth },
        },
      ],
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  return { events }
}

// ============================================================
// イベント詳細取得
// ============================================================

/**
 * イベント詳細を取得
 *
 * ## 機能概要
 * 指定されたイベントの詳細情報を取得します。
 *
 * ## 返却情報
 * - イベント基本情報
 * - 作成者情報
 * - isOwner: 現在のユーザーが所有者かどうか
 *
 * @param eventId - イベントID
 * @returns イベント詳細、または { error: string }
 *
 * @example
 * ```typescript
 * const { event, error } = await getEvent('event-123')
 *
 * if (event) {
 *   console.log(event.title)
 *   if (event.isOwner) {
 *     // 編集・削除ボタンを表示
 *   }
 * }
 * ```
 */
export async function getEvent(eventId: string) {
  // ------------------------------------------------------------
  // 現在のユーザーを取得
  // ------------------------------------------------------------

  const session = await auth()
  const currentUserId = session?.user?.id

  // ------------------------------------------------------------
  // イベントを取得
  // ------------------------------------------------------------

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
      isHidden: false,  // 非表示イベントは取得しない
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
  })

  // ------------------------------------------------------------
  // 存在チェック
  // ------------------------------------------------------------

  if (!event) {
    return { error: 'イベントが見つかりません' }
  }

  // ------------------------------------------------------------
  // 結果を返却
  // ------------------------------------------------------------

  return {
    event: {
      ...event,
      /**
       * isOwner: 現在のユーザーが作成者かどうか
       * 編集・削除ボタンの表示制御に使用
       */
      isOwner: currentUserId === event.createdBy,
    },
  }
}

// ============================================================
// イベント登録
// ============================================================

/**
 * イベントを登録
 *
 * ## 機能概要
 * 新しいイベントを作成します。
 *
 * ## 必須項目
 * - title: イベント名
 * - startDate: 開始日
 * - prefecture: 都道府県
 *
 * ## オプション項目
 * - endDate: 終了日
 * - city: 市区町村
 * - venue: 会場名
 * - organizer: 主催者
 * - fee: 入場料
 * - hasSales: 即売あり/なし
 * - description: 説明文
 * - externalUrl: 外部リンク
 *
 * @param formData - フォームデータ
 * @returns 成功時は { success: true, eventId }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await createEvent(formData)
 *
 * if (result.success) {
 *   router.push(`/events/${result.eventId}`)
 * } else {
 *   toast.error(result.error)
 * }
 * ```
 */
export async function createEvent(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  const title = formData.get('title') as string
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string | null
  const prefecture = formData.get('prefecture') as string
  const city = formData.get('city') as string | null
  const venue = formData.get('venue') as string | null
  const organizer = formData.get('organizer') as string | null
  const fee = formData.get('fee') as string | null
  const hasSales = formData.get('hasSales') === 'true'
  const description = formData.get('description') as string | null
  const externalUrl = formData.get('externalUrl') as string | null

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  /**
   * タイトルは必須
   */
  if (!title || title.trim().length === 0) {
    return { error: 'タイトルを入力してください' }
  }

  /**
   * 開始日は必須
   */
  if (!startDateStr) {
    return { error: '開始日を選択してください' }
  }

  /**
   * 都道府県は必須
   */
  if (!prefecture) {
    return { error: '都道府県を選択してください' }
  }

  // ------------------------------------------------------------
  // 日付の変換とバリデーション
  // ------------------------------------------------------------

  const startDate = new Date(startDateStr)
  const endDate = endDateStr ? new Date(endDateStr) : null

  /**
   * 終了日は開始日以降である必要がある
   */
  if (endDate && endDate < startDate) {
    return { error: '終了日は開始日以降を選択してください' }
  }

  // ------------------------------------------------------------
  // イベントを作成
  // ------------------------------------------------------------

  const event = await prisma.event.create({
    data: {
      createdBy: session.user.id,
      title: title.trim(),
      startDate,
      endDate,
      prefecture,
      city: city?.trim() || null,
      venue: venue?.trim() || null,
      organizer: organizer?.trim() || null,
      /**
       * admissionFee: 入場料（カラム名が異なる）
       */
      admissionFee: fee?.trim() || null,
      hasSales,
      description: description?.trim() || null,
      externalUrl: externalUrl?.trim() || null,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  /**
   * イベント一覧ページのキャッシュを更新
   */
  revalidatePath('/events')

  return { success: true, eventId: event.id }
}

// ============================================================
// イベント更新
// ============================================================

/**
 * イベントを更新
 *
 * ## 機能概要
 * 既存のイベントを更新します。
 *
 * ## 権限
 * イベント作成者のみ更新可能
 *
 * @param eventId - イベントID
 * @param formData - フォームデータ
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await updateEvent('event-123', formData)
 *
 * if (result.success) {
 *   toast.success('更新しました')
 * }
 * ```
 */
export async function updateEvent(eventId: string, formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 所有者確認
  // ------------------------------------------------------------

  /**
   * イベントの作成者を取得
   */
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdBy: true },
  })

  if (!existingEvent) {
    return { error: 'イベントが見つかりません' }
  }

  /**
   * 作成者でなければ編集不可
   */
  if (existingEvent.createdBy !== session.user.id) {
    return { error: '編集権限がありません' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  const title = formData.get('title') as string
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string | null
  const prefecture = formData.get('prefecture') as string
  const city = formData.get('city') as string | null
  const venue = formData.get('venue') as string | null
  const organizer = formData.get('organizer') as string | null
  const fee = formData.get('fee') as string | null
  const hasSales = formData.get('hasSales') === 'true'
  const description = formData.get('description') as string | null
  const externalUrl = formData.get('externalUrl') as string | null

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  if (!title || title.trim().length === 0) {
    return { error: 'タイトルを入力してください' }
  }

  if (!startDateStr) {
    return { error: '開始日を選択してください' }
  }

  if (!prefecture) {
    return { error: '都道府県を選択してください' }
  }

  const startDate = new Date(startDateStr)
  const endDate = endDateStr ? new Date(endDateStr) : null

  if (endDate && endDate < startDate) {
    return { error: '終了日は開始日以降を選択してください' }
  }

  // ------------------------------------------------------------
  // イベントを更新
  // ------------------------------------------------------------

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: title.trim(),
      startDate,
      endDate,
      prefecture,
      city: city?.trim() || null,
      venue: venue?.trim() || null,
      organizer: organizer?.trim() || null,
      admissionFee: fee?.trim() || null,
      hasSales,
      description: description?.trim() || null,
      externalUrl: externalUrl?.trim() || null,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  /**
   * 一覧ページと詳細ページのキャッシュを更新
   */
  revalidatePath('/events')
  revalidatePath(`/events/${eventId}`)

  return { success: true }
}

// ============================================================
// イベント削除
// ============================================================

/**
 * イベントを削除
 *
 * ## 機能概要
 * イベントを削除します。
 *
 * ## 権限
 * イベント作成者のみ削除可能
 *
 * @param eventId - イベントID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteEvent('event-123')
 *
 * if (result.success) {
 *   router.push('/events')
 * }
 * ```
 */
export async function deleteEvent(eventId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 所有者確認
  // ------------------------------------------------------------

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdBy: true },
  })

  if (!event) {
    return { error: 'イベントが見つかりません' }
  }

  if (event.createdBy !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  // ------------------------------------------------------------
  // イベントを削除
  // ------------------------------------------------------------

  await prisma.event.delete({
    where: { id: eventId },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath('/events')

  return { success: true }
}

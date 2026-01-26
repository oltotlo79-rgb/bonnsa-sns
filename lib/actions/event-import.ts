/**
 * イベントインポート用Server Actions
 *
 * 外部サイトからイベント情報をスクレイピングし、
 * 管理者がインポートできる機能を提供
 */

'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  scrapeAllEvents,
  scrapeEventsFromRegion,
  BONSAI_EVENT_SOURCES,
  type ScrapedEvent,
} from '@/lib/scraping/bonsai-events'

/**
 * 重複タイプの定義
 * - 'exact': 完全重複（同タイトル・同期間・同都道府県）→ 表示しない
 * - 'similar': 類似イベント（類似タイトル・同都道府県・異なる期間）→ 黄色警告
 * - null: 重複なし
 */
export type DuplicateType = 'exact' | 'similar' | null

/**
 * インポート用イベントデータの型（クライアントに送信可能な形式）
 */
export interface ImportableEvent {
  id: string // 一時ID（インポート時の識別用）
  title: string
  startDate: string | null
  endDate: string | null
  prefecture: string | null
  city: string | null
  venue: string | null
  organizer: string | null
  admissionFee: string | null
  hasSales: boolean
  description: string
  externalUrl: string | null
  sourceRegion: string
  sourceUrl: string
  isDuplicate: boolean // 後方互換性のため残す（similarの場合true）
  duplicateType: DuplicateType // 重複タイプ
  similarEventTitle?: string // 類似イベントのタイトル（警告表示用）
}

/**
 * 管理者権限チェック
 */
async function checkAdminAuth(): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
  })

  if (!adminUser) {
    return { error: '管理者権限が必要です' }
  }

  return { userId: session.user.id }
}

/**
 * 重複チェック結果の型
 */
interface DuplicateCheckResult {
  type: DuplicateType
  similarEventTitle?: string
}

/**
 * タイトルの類似度を計算（簡易版）
 * タイトルの先頭10文字が一致、または一方が他方を含む場合に類似とみなす
 */
function isSimilarTitle(title1: string, title2: string): boolean {
  const normalized1 = title1.replace(/\s+/g, '').toLowerCase()
  const normalized2 = title2.replace(/\s+/g, '').toLowerCase()

  // 完全一致
  if (normalized1 === normalized2) return true

  // 先頭10文字が一致
  if (normalized1.substring(0, 10) === normalized2.substring(0, 10)) return true

  // 一方が他方を含む
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true

  return false
}

/**
 * 日付が同じかどうかをチェック（日付部分のみ比較）
 */
function isSameDate(date1: Date | null, date2: Date | null): boolean {
  if (!date1 && !date2) return true
  if (!date1 || !date2) return false

  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0]
}

/**
 * 重複チェック
 * - 完全重複: 同タイトル・同期間・同都道府県 → 'exact'
 * - 類似イベント: 類似タイトル・同都道府県・異なる期間 → 'similar'
 * - 重複なし: null
 */
async function checkDuplicates(events: ScrapedEvent[]): Promise<Map<string, DuplicateCheckResult>> {
  const duplicateMap = new Map<string, DuplicateCheckResult>()

  for (const event of events) {
    if (!event.startDate) {
      duplicateMap.set(event.title, { type: null })
      continue
    }

    // 同じ都道府県で類似タイトルのイベントを検索
    const existingEvents = await prisma.event.findMany({
      where: {
        isHidden: false,
        ...(event.prefecture && { prefecture: event.prefecture }),
      },
      select: {
        title: true,
        startDate: true,
        endDate: true,
        prefecture: true,
      },
    })

    let duplicateResult: DuplicateCheckResult = { type: null }

    for (const existing of existingEvents) {
      // タイトルが類似しているかチェック
      if (!isSimilarTitle(event.title, existing.title)) {
        continue
      }

      // 完全重複チェック: 同タイトル・同期間・同都道府県
      const isSameStartDate = isSameDate(event.startDate, existing.startDate)
      const isSameEndDate = isSameDate(event.endDate, existing.endDate)
      const isSamePrefecture = event.prefecture === existing.prefecture

      if (isSameStartDate && isSameEndDate && isSamePrefecture) {
        // 完全重複 → 表示しない
        duplicateResult = { type: 'exact', similarEventTitle: existing.title }
        break // 完全重複が見つかったらそれ以上チェック不要
      }

      // 類似イベント: 類似タイトル・同都道府県・異なる期間
      if (isSamePrefecture && (!isSameStartDate || !isSameEndDate)) {
        duplicateResult = { type: 'similar', similarEventTitle: existing.title }
        // 類似が見つかっても完全重複を探し続ける
      }
    }

    duplicateMap.set(event.title, duplicateResult)
  }

  return duplicateMap
}

/**
 * ScrapedEventをImportableEventに変換
 */
function toImportableEvent(
  event: ScrapedEvent,
  index: number,
  duplicateResult: DuplicateCheckResult
): ImportableEvent {
  return {
    id: `scraped-${index}-${Date.now()}`,
    title: event.title,
    startDate: event.startDate?.toISOString() || null,
    endDate: event.endDate?.toISOString() || null,
    prefecture: event.prefecture,
    city: event.city,
    venue: event.venue,
    organizer: event.organizer,
    admissionFee: event.admissionFee,
    hasSales: event.hasSales,
    description: event.description,
    externalUrl: event.externalUrl,
    sourceRegion: event.sourceRegion,
    sourceUrl: event.sourceUrl,
    isDuplicate: duplicateResult.type === 'similar', // 後方互換性
    duplicateType: duplicateResult.type,
    similarEventTitle: duplicateResult.similarEventTitle,
  }
}

/**
 * 全地方のイベントをスクレイピング（プレビュー用）
 */
export async function scrapeExternalEvents(): Promise<
  { events: ImportableEvent[]; filteredCount: number } | { error: string }
> {
  // 管理者チェック
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  try {
    // スクレイピング実行
    const scrapedEvents = await scrapeAllEvents()

    if (scrapedEvents.length === 0) {
      return { error: 'イベントが見つかりませんでした' }
    }

    // 重複チェック
    const duplicateMap = await checkDuplicates(scrapedEvents)

    // ImportableEvent形式に変換し、完全重複を除外
    let filteredCount = 0
    const events: ImportableEvent[] = []

    scrapedEvents.forEach((event, index) => {
      const duplicateResult = duplicateMap.get(event.title) || { type: null }

      // 完全重複は除外
      if (duplicateResult.type === 'exact') {
        filteredCount++
        return
      }

      events.push(toImportableEvent(event, index, duplicateResult))
    })

    return { events, filteredCount }
  } catch (error) {
    console.error('Scraping error:', error)
    return { error: 'スクレイピング中にエラーが発生しました' }
  }
}

/**
 * 特定の地方のイベントをスクレイピング
 */
export async function scrapeEventsByRegion(
  regionId: string
): Promise<{ events: ImportableEvent[]; filteredCount: number } | { error: string }> {
  // 管理者チェック
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  const source = BONSAI_EVENT_SOURCES.find(
    (s) => s.region === regionId || s.url.includes(regionId)
  )

  if (!source) {
    return { error: '指定された地方が見つかりません' }
  }

  try {
    const scrapedEvents = await scrapeEventsFromRegion(
      source.url,
      source.region,
      source.prefectures
    )

    if (scrapedEvents.length === 0) {
      return { error: 'イベントが見つかりませんでした' }
    }

    const duplicateMap = await checkDuplicates(scrapedEvents)

    // ImportableEvent形式に変換し、完全重複を除外
    let filteredCount = 0
    const events: ImportableEvent[] = []

    scrapedEvents.forEach((event, index) => {
      const duplicateResult = duplicateMap.get(event.title) || { type: null }

      // 完全重複は除外
      if (duplicateResult.type === 'exact') {
        filteredCount++
        return
      }

      events.push(toImportableEvent(event, index, duplicateResult))
    })

    return { events, filteredCount }
  } catch (error) {
    console.error('Scraping error:', error)
    return { error: 'スクレイピング中にエラーが発生しました' }
  }
}

/**
 * 選択されたイベントをインポート
 */
export async function importSelectedEvents(
  events: ImportableEvent[]
): Promise<{ success: true; importedCount: number } | { error: string }> {
  // 管理者チェック
  const authResult = await checkAdminAuth()
  if ('error' in authResult) {
    return { error: authResult.error }
  }

  if (!events || events.length === 0) {
    return { error: 'インポートするイベントが選択されていません' }
  }

  try {
    let importedCount = 0

    for (const event of events) {
      // 日付がないイベントはスキップ
      if (!event.startDate) {
        continue
      }

      // 重複チェック（念のため再確認）
      const existing = await prisma.event.findFirst({
        where: {
          title: event.title,
          startDate: new Date(event.startDate),
          isHidden: false,
        },
      })

      if (existing) {
        continue // 重複はスキップ
      }

      // イベント作成
      await prisma.event.create({
        data: {
          title: event.title,
          description: event.description || null,
          startDate: new Date(event.startDate),
          endDate: event.endDate ? new Date(event.endDate) : null,
          prefecture: event.prefecture || null,
          city: event.city || null,
          venue: event.venue || null,
          organizer: event.organizer || null,
          admissionFee: event.admissionFee || null,
          hasSales: event.hasSales,
          externalUrl: event.externalUrl || null,
          createdBy: authResult.userId,
        },
      })

      importedCount++
    }

    // キャッシュ再検証
    revalidatePath('/events')
    revalidatePath('/admin/events')

    return { success: true, importedCount }
  } catch (error) {
    console.error('Import error:', error)
    return { error: 'インポート中にエラーが発生しました' }
  }
}

/**
 * 利用可能な地方リストを取得
 */
export async function getAvailableRegions(): Promise<
  { regions: { id: string; name: string; url: string }[] }
> {
  return {
    regions: BONSAI_EVENT_SOURCES.map((source) => ({
      id: source.region,
      name: source.region,
      url: source.url,
    })),
  }
}

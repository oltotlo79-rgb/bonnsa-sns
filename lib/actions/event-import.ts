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
  isDuplicate: boolean // 既存イベントと重複の可能性
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
 * 重複チェック
 * タイトルと開始日が同じイベントが既に存在するかチェック
 */
async function checkDuplicates(events: ScrapedEvent[]): Promise<Map<string, boolean>> {
  const duplicateMap = new Map<string, boolean>()

  for (const event of events) {
    if (!event.startDate) {
      duplicateMap.set(event.title, false)
      continue
    }

    // タイトルの類似性チェック（完全一致または部分一致）
    const existingEvent = await prisma.event.findFirst({
      where: {
        OR: [
          { title: event.title },
          { title: { contains: event.title.substring(0, 10) } },
        ],
        startDate: {
          gte: new Date(event.startDate.getTime() - 24 * 60 * 60 * 1000), // 1日前
          lte: new Date(event.startDate.getTime() + 24 * 60 * 60 * 1000), // 1日後
        },
        isHidden: false,
      },
    })

    duplicateMap.set(event.title, !!existingEvent)
  }

  return duplicateMap
}

/**
 * ScrapedEventをImportableEventに変換
 */
function toImportableEvent(
  event: ScrapedEvent,
  index: number,
  isDuplicate: boolean
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
    isDuplicate,
  }
}

/**
 * 全地方のイベントをスクレイピング（プレビュー用）
 */
export async function scrapeExternalEvents(): Promise<
  { events: ImportableEvent[] } | { error: string }
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

    // ImportableEvent形式に変換
    const events = scrapedEvents.map((event, index) =>
      toImportableEvent(event, index, duplicateMap.get(event.title) || false)
    )

    return { events }
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
): Promise<{ events: ImportableEvent[] } | { error: string }> {
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

    const events = scrapedEvents.map((event, index) =>
      toImportableEvent(event, index, duplicateMap.get(event.title) || false)
    )

    return { events }
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

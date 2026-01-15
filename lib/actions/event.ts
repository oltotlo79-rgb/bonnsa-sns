'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getPrefecturesByRegion, type Region } from '@/lib/constants/prefectures'

// イベント一覧取得
export async function getEvents(options?: {
  region?: string
  prefecture?: string
  showPast?: boolean
  month?: number
  year?: number
}) {
  const { region, prefecture, showPast = false, month, year } = options || {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 地域フィルター
  let prefectureFilter: string[] | undefined
  if (prefecture) {
    prefectureFilter = [prefecture]
  } else if (region) {
    prefectureFilter = getPrefecturesByRegion(region as Region)
  }

  // 月フィルター
  let dateFilter: { gte?: Date; lt?: Date } | undefined
  if (month !== undefined && year !== undefined) {
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 1)
    dateFilter = {
      gte: startOfMonth,
      lt: endOfMonth,
    }
  } else if (!showPast) {
    dateFilter = { gte: today }
  }

  const events = await prisma.event.findMany({
    where: {
      ...(dateFilter && { startDate: dateFilter }),
      ...(prefectureFilter && { prefecture: { in: prefectureFilter } }),
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

// 今後のイベント取得
export async function getUpcomingEvents(limit = 10, region?: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const prefectures = region ? getPrefecturesByRegion(region as Region) : undefined

  const events = await prisma.event.findMany({
    where: {
      startDate: { gte: today },
      ...(prefectures && { prefecture: { in: prefectures } }),
    },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { startDate: 'asc' },
    take: limit,
  })

  return { events }
}

// 月別イベント取得（カレンダー用）
export async function getEventsByMonth(year: number, month: number) {
  const startOfMonth = new Date(year, month, 1)
  const endOfMonth = new Date(year, month + 1, 1)

  const events = await prisma.event.findMany({
    where: {
      OR: [
        // 開始日が月内
        {
          startDate: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
        // 終了日が月内
        {
          endDate: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
        // イベントが月をまたぐ
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

// イベント詳細取得
export async function getEvent(eventId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
  })

  if (!event) {
    return { error: 'イベントが見つかりません' }
  }

  return {
    event: {
      ...event,
      isOwner: currentUserId === event.createdBy,
    },
  }
}

// イベント登録
export async function createEvent(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

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

  // バリデーション
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
      admissionFee: fee?.trim() || null,
      hasSales,
      description: description?.trim() || null,
      externalUrl: externalUrl?.trim() || null,
    },
  })

  revalidatePath('/events')
  return { success: true, eventId: event.id }
}

// イベント更新
export async function updateEvent(eventId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 所有者確認
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdBy: true },
  })

  if (!existingEvent) {
    return { error: 'イベントが見つかりません' }
  }

  if (existingEvent.createdBy !== session.user.id) {
    return { error: '編集権限がありません' }
  }

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

  // バリデーション
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

  revalidatePath('/events')
  revalidatePath(`/events/${eventId}`)
  return { success: true }
}

// イベント削除
export async function deleteEvent(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // 所有者確認
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

  await prisma.event.delete({
    where: { id: eventId },
  })

  revalidatePath('/events')
  return { success: true }
}

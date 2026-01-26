/**
 * @jest-environment node
 */

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// スクレイピングモック
const mockScrapeAllEvents = jest.fn()
const mockScrapeEventsFromRegion = jest.fn()
jest.mock('@/lib/scraping/bonsai-events', () => ({
  scrapeAllEvents: () => mockScrapeAllEvents(),
  scrapeEventsFromRegion: (...args: unknown[]) => mockScrapeEventsFromRegion(...args),
  BONSAI_EVENT_SOURCES: [
    { region: '関東', url: 'https://www.bonsai.co.jp/event/event_category/kanto/', prefectures: ['東京都'] },
    { region: '近畿', url: 'https://www.bonsai.co.jp/event/event_category/kinki/', prefectures: ['大阪府'] },
  ],
}))

describe('Event Import Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // 管理者として認証
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id })
  })

  describe('scrapeExternalEvents', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者権限が必要', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('イベントをスクレイピングできる', async () => {
      const mockEvents = [
        {
          title: '盆栽展',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-03-02'),
          prefecture: '東京都',
          city: null,
          venue: '上野公園',
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: 'テスト',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // checkDuplicates用のモック（既存イベントなし）
      mockPrisma.event.findMany.mockResolvedValue([])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect('events' in result).toBe(true)
      if ('events' in result) {
        expect(result.events).toHaveLength(1)
        expect(result.events[0].title).toBe('盆栽展')
      }
    })

    it('イベントが見つからない場合はエラー', async () => {
      mockScrapeAllEvents.mockResolvedValue([])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toEqual({ error: 'イベントが見つかりませんでした' })
    })

    it('スクレイピングエラー時はエラーを返す', async () => {
      mockScrapeAllEvents.mockRejectedValue(new Error('Network error'))

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toEqual({ error: 'スクレイピング中にエラーが発生しました' })
    })

    it('重複イベントを検出する', async () => {
      const mockEvents = [
        {
          title: '既存の展示会',
          startDate: new Date('2025-03-01'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'existing-event' })
      // checkDuplicates用のモック（類似イベントが存在）
      mockPrisma.event.findMany.mockResolvedValue([
        {
          title: '既存の展示会',
          startDate: new Date('2025-04-01'), // 異なる日付
          endDate: null,
          prefecture: '東京都',
        },
      ])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect('events' in result).toBe(true)
      if ('events' in result) {
        expect(result.events[0].isDuplicate).toBe(true)
      }
    })
  })

  describe('scrapeEventsByRegion', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('関東')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('指定地方のイベントをスクレイピングできる', async () => {
      const mockEvents = [
        {
          title: '関東盆栽展',
          startDate: new Date('2025-04-01'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeEventsFromRegion.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // checkDuplicates用のモック（既存イベントなし）
      mockPrisma.event.findMany.mockResolvedValue([])

      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('関東')

      expect('events' in result).toBe(true)
      if ('events' in result) {
        expect(result.events).toHaveLength(1)
      }
    })

    it('存在しない地方はエラー', async () => {
      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('存在しない地方')

      expect(result).toEqual({ error: '指定された地方が見つかりません' })
    })

    it('イベントが見つからない場合はエラー', async () => {
      mockScrapeEventsFromRegion.mockResolvedValue([])

      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('関東')

      expect(result).toEqual({ error: 'イベントが見つかりませんでした' })
    })
  })

  describe('importSelectedEvents', () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents([])

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('イベントが選択されていない場合はエラー', async () => {
      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents([])

      expect(result).toEqual({ error: 'インポートするイベントが選択されていません' })
    })

    it('イベントをインポートできる', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null)
      mockPrisma.event.create.mockResolvedValue({ id: 'new-event' })

      const events = [
        {
          id: 'temp-1',
          title: '新しい展示会',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: '2025-05-02T00:00:00.000Z',
          prefecture: '東京都',
          city: '渋谷区',
          venue: '渋谷ホール',
          organizer: '日本盆栽協会',
          admissionFee: '無料',
          hasSales: true,
          description: '説明文',
          externalUrl: 'https://example.com',
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect('success' in result).toBe(true)
      if ('success' in result) {
        expect(result.importedCount).toBe(1)
      }
      expect(mockPrisma.event.create).toHaveBeenCalled()
    })

    it('日付がないイベントはスキップ', async () => {
      const events = [
        {
          id: 'temp-1',
          title: '日付なしイベント',
          startDate: null,
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect('success' in result).toBe(true)
      if ('success' in result) {
        expect(result.importedCount).toBe(0)
      }
      expect(mockPrisma.event.create).not.toHaveBeenCalled()
    })

    it('重複イベントはスキップ', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'existing' })

      const events = [
        {
          id: 'temp-1',
          title: '既存イベント',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: true,
          duplicateType: 'similar' as const,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect('success' in result).toBe(true)
      if ('success' in result) {
        expect(result.importedCount).toBe(0)
      }
      expect(mockPrisma.event.create).not.toHaveBeenCalled()
    })

    it('インポートエラー時はエラーを返す', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null)
      mockPrisma.event.create.mockRejectedValue(new Error('DB error'))

      const events = [
        {
          id: 'temp-1',
          title: 'エラーイベント',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result).toEqual({ error: 'インポート中にエラーが発生しました' })
    })
  })

  describe('getAvailableRegions', () => {
    it('利用可能な地方リストを返す', async () => {
      const { getAvailableRegions } = await import('@/lib/actions/event-import')
      const result = await getAvailableRegions()

      expect(result.regions).toHaveLength(2)
      expect(result.regions[0].name).toBe('関東')
      expect(result.regions[1].name).toBe('近畿')
    })
  })
})

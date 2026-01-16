import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'

// テスト用のモックデータ
export const mockUser = {
  id: 'test-user-id',
  nickname: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: '/test-avatar.jpg',
  bio: 'テスト用の自己紹介',
  isPublic: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

export const mockPost = {
  id: 'test-post-id',
  userId: mockUser.id,
  content: 'テスト投稿の内容 #テスト',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  media: [],
  genres: [{ id: 'genre-1', name: '松柏類', category: '松柏類' }],
  likeCount: 5,
  commentCount: 3,
  isLiked: false,
  isBookmarked: false,
}

export const mockComment = {
  id: 'test-comment-id',
  postId: mockPost.id,
  userId: mockUser.id,
  content: 'テストコメント',
  createdAt: new Date('2024-01-01'),
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  likeCount: 2,
  isLiked: false,
}

export const mockSession = {
  user: {
    id: mockUser.id,
    name: mockUser.nickname,
    email: mockUser.email,
    image: mockUser.avatarUrl,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

export const mockGenres = [
  { id: 'genre-1', name: '黒松', category: '松柏類', sortOrder: 1 },
  { id: 'genre-2', name: '五葉松', category: '松柏類', sortOrder: 2 },
  { id: 'genre-3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
]

export const mockNotification = {
  id: 'notification-1',
  userId: mockUser.id,
  actorId: 'other-user-id',
  type: 'like',
  postId: mockPost.id,
  isRead: false,
  createdAt: new Date('2024-01-01'),
  actor: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

export const mockConversation = {
  id: 'conversation-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  participants: [
    {
      userId: mockUser.id,
      user: mockUser,
    },
    {
      userId: 'other-user-id',
      user: {
        id: 'other-user-id',
        nickname: '他のユーザー',
        avatarUrl: '/other-avatar.jpg',
      },
    },
  ],
  messages: [],
  unreadCount: 0,
}

export const mockEvent = {
  id: 'test-event-id',
  createdBy: mockUser.id,
  title: 'テストイベント',
  startDate: new Date('2025-02-01'),
  endDate: new Date('2025-02-02'),
  prefecture: '東京都',
  city: '渋谷区',
  venue: 'テスト会場',
  organizer: 'テスト主催者',
  admissionFee: '無料',
  hasSales: true,
  description: 'テストイベントの説明',
  externalUrl: 'https://example.com/event',
  isHidden: false,
  hiddenAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  creator: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

export const mockShop = {
  id: 'test-shop-id',
  name: 'テスト盆栽園',
  address: '東京都渋谷区代々木1-1-1',
  latitude: 35.6762,
  longitude: 139.6503,
  phone: '03-1234-5678',
  website: 'https://example.com/shop',
  businessHours: '9:00-17:00',
  closedDays: '水曜日',
  createdBy: mockUser.id,
  isHidden: false,
  hiddenAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  creator: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  genres: [],
  reviews: [],
}

export const mockReview = {
  id: 'test-review-id',
  shopId: 'test-shop-id',
  userId: mockUser.id,
  rating: 5,
  content: 'とても素晴らしい盆栽園です',
  isHidden: false,
  hiddenAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  images: [],
}

export const mockReport = {
  id: 'test-report-id',
  reporterId: mockUser.id,
  targetType: 'post',
  targetId: 'test-post-id',
  reason: 'spam',
  description: 'スパム投稿です',
  status: 'pending',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  reporter: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

export const mockAdminUser = {
  id: 'admin-id',
  userId: mockUser.id,
  createdAt: new Date('2024-01-01'),
}

export const mockAdminNotification = {
  id: 'notification-id',
  type: 'auto_hidden',
  targetType: 'post',
  targetId: 'test-post-id',
  message: '投稿が10件の通報を受け自動非表示になりました',
  reportCount: 10,
  isRead: false,
  isResolved: false,
  resolvedAt: null,
  createdAt: new Date('2024-01-01'),
}

// カスタムレンダラー
interface AllProvidersProps {
  children: React.ReactNode
}

function AllProviders({ children }: AllProvidersProps) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return (
    <SessionProvider session={mockSession}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

// re-export everything
export * from '@testing-library/react'
export { customRender as render }

// ユーティリティ関数
export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

export async function waitForLoadingToFinish() {
  // ローディング状態が終わるまで待機
  await new Promise((resolve) => setTimeout(resolve, 0))
}

// Prismaモック用ヘルパー
export const createMockPrismaClient = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  post: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  comment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  like: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  follow: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  bookmark: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  block: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  mute: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  genre: {
    findMany: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  bonsaiShop: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  shopGenre: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  shopReview: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  report: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  adminUser: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  adminNotification: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  adminLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    if (typeof callback === 'function') {
      return callback({
        post: { update: jest.fn() },
        comment: { update: jest.fn() },
        event: { update: jest.fn() },
        bonsaiShop: { update: jest.fn() },
        shopReview: { update: jest.fn() },
        user: { update: jest.fn() },
        report: { update: jest.fn(), updateMany: jest.fn() },
        adminNotification: { create: jest.fn() },
        adminLog: { create: jest.fn() },
      })
    }
    return Promise.resolve(callback)
  }),
})

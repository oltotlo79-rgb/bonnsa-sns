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

// メッセージ関連のモック
export const mockMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: mockUser.id,
  content: 'テストメッセージです',
  isRead: false,
  createdAt: new Date('2024-01-01'),
  sender: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

// 下書き関連のモック
export const mockDraft = {
  id: 'draft-1',
  userId: mockUser.id,
  content: '下書きの内容',
  mediaUrls: [],
  genreIds: ['genre-1'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

// 予約投稿関連のモック
export const mockScheduledPost = {
  id: 'scheduled-1',
  userId: mockUser.id,
  content: '予約投稿の内容',
  mediaUrls: [],
  genreIds: ['genre-1'],
  scheduledAt: new Date('2024-02-01T10:00:00Z'),
  status: 'pending' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

// 盆栽関連のモック
export const mockBonsai = {
  id: 'bonsai-1',
  userId: mockUser.id,
  name: 'テスト黒松',
  species: '黒松',
  acquisitionDate: new Date('2020-01-01'),
  acquisitionType: 'purchase' as const,
  description: 'テスト盆栽の説明',
  imageUrl: '/bonsai-image.jpg',
  isPublic: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

export const mockBonsaiRecord = {
  id: 'record-1',
  bonsaiId: 'bonsai-1',
  userId: mockUser.id,
  recordType: 'watering' as const,
  title: '水やり記録',
  description: '朝の水やりを行いました',
  imageUrls: [],
  recordDate: new Date('2024-01-15'),
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
}

// パスワードリセット関連のモック
export const mockPasswordResetToken = {
  id: 'token-1',
  email: mockUser.email,
  token: 'reset-token-123',
  expires: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
  createdAt: new Date('2024-01-01'),
}

// ハッシュタグ関連のモック
export const mockHashtag = {
  id: 'hashtag-1',
  name: 'テスト',
  postCount: 10,
  createdAt: new Date('2024-01-01'),
}

// ユーザー分析関連のモック
export const mockUserAnalytics = {
  id: 'analytics-1',
  userId: mockUser.id,
  date: new Date('2024-01-01'),
  profileViews: 100,
  postViews: 500,
  likesReceived: 50,
  newFollowers: 10,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

// ブロック関連のモック
export const mockBlock = {
  id: 'block-1',
  blockerId: mockUser.id,
  blockedId: 'other-user-id',
  createdAt: new Date('2024-01-01'),
  blocked: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

// ミュート関連のモック
export const mockMute = {
  id: 'mute-1',
  muterId: mockUser.id,
  mutedId: 'other-user-id',
  createdAt: new Date('2024-01-01'),
  muted: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

// フォロー関連のモック
export const mockFollow = {
  id: 'follow-1',
  followerId: mockUser.id,
  followingId: 'other-user-id',
  createdAt: new Date('2024-01-01'),
  following: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

// いいね関連のモック
export const mockLike = {
  id: 'like-1',
  userId: mockUser.id,
  postId: mockPost.id,
  createdAt: new Date('2024-01-01'),
}

// ブックマーク関連のモック
export const mockBookmark = {
  id: 'bookmark-1',
  userId: mockUser.id,
  postId: mockPost.id,
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
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  postMedia: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
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
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  bookmark: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  notification: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  block: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  mute: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  followRequest: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
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
    createMany: jest.fn(),
  },
  shopChangeRequest: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
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
    count: jest.fn(),
  },
  // メッセージ関連
  conversation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  conversationParticipant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  message: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  // 下書き・予約投稿関連
  draftPost: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  draftPostMedia: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  draftPostGenre: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  scheduledPost: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  scheduledPostMedia: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  scheduledPostGenre: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  // 盆栽関連
  bonsai: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  bonsaiRecord: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  // ハッシュタグ関連
  hashtag: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  postHashtag: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  // パスワードリセット関連
  passwordResetToken: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  // ユーザー分析関連
  userAnalytics: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  // PostGenre関連
  postGenre: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  // サブスクリプション関連
  subscription: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  paymentHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  // ShopReviewImage関連
  shopReviewImage: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((callbackOrArray) => {
    // Array form: resolve each operation and return results
    if (Array.isArray(callbackOrArray)) {
      return Promise.all(callbackOrArray)
    }
    // Function form: call with mock tx client
    if (typeof callbackOrArray === 'function') {
      return callbackOrArray({
        post: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        postMedia: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
        postGenre: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
        postHashtag: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
        comment: { update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        event: { update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        bonsaiShop: { update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        shopReview: { update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        shopReviewImage: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
        user: { update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        report: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
        adminNotification: { create: jest.fn().mockResolvedValue({}) },
        adminLog: { create: jest.fn().mockResolvedValue({}) },
        notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
        like: { deleteMany: jest.fn().mockResolvedValue({}) },
        bookmark: { deleteMany: jest.fn().mockResolvedValue({}) },
        follow: { deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
        followRequest: { delete: jest.fn().mockResolvedValue({}) },
        block: { deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
        mute: { deleteMany: jest.fn().mockResolvedValue({}) },
        conversation: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
        conversationParticipant: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
        message: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
        draftPost: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        scheduledPost: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        bonsai: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        bonsaiRecord: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) },
        hashtag: { upsert: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
        userAnalytics: { upsert: jest.fn().mockResolvedValue({}) },
        subscription: { update: jest.fn().mockResolvedValue({}) },
      })
    }
    return Promise.resolve(callbackOrArray)
  }),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
})

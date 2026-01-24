import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

// Prisma/DBモック（コンポーネントインポート前に必須）
jest.mock('@/lib/db', () => ({
  prisma: {},
}))

// Server Actions モック（ホイスティング対応）
jest.mock('@/lib/actions/review', () => ({
  deleteReview: jest.fn(),
  updateReview: jest.fn(),
}))

// client-image-compression モック
jest.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: jest.fn(),
  formatFileSize: jest.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

// ReportButton モック（内部でアクションを使用するため）
jest.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button>通報</button>,
}))

import { ReviewCard } from '@/components/shop/ReviewCard'

// モック関数にアクセス
import { deleteReview, updateReview } from '@/lib/actions/review'
const mockDeleteReview = deleteReview as jest.Mock
const mockUpdateReview = updateReview as jest.Mock

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}))

const mockReview = {
  id: 'review-1',
  rating: 4,
  content: 'とても良い盆栽園でした',
  createdAt: new Date(),
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  images: [],
}

describe('ReviewCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('レビューを表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText('とても良い盆栽園でした')).toBeInTheDocument()
  })

  it('ユーザーアバターがない場合はイニシャルを表示', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('自分のレビューには編集・削除ボタンを表示', () => {
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)
    // 編集ボタン（PencilIcon）と削除ボタン（TrashIcon）
    expect(screen.getByTitle('編集')).toBeInTheDocument()
    expect(screen.getByTitle('削除')).toBeInTheDocument()
  })

  it('他人のレビューには編集・削除ボタンを表示しない', () => {
    render(<ReviewCard review={mockReview} currentUserId="other-user" />)
    // 通報ボタンのみ表示される
    expect(screen.queryByTitle('編集')).not.toBeInTheDocument()
    expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
  })

  it('削除確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    // 削除ボタンをクリック
    const deleteButton = screen.getByTitle('削除')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
  })

  it('削除をキャンセルできる', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    const deleteButton = screen.getByTitle('削除')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
    })

    await user.click(screen.getByText('キャンセル'))

    await waitFor(() => {
      expect(screen.queryByText('削除する')).not.toBeInTheDocument()
    })
  })

  it('編集モードに切り替える', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    const editButton = screen.getByTitle('編集')
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByDisplayValue('とても良い盆栽園でした')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })
  })

  it('削除を実行する', async () => {
    mockDeleteReview.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    // 削除ボタンをクリック
    const deleteButton = screen.getByTitle('削除')
    await user.click(deleteButton)

    // 削除確認ダイアログで「削除する」をクリック
    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
    await user.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockDeleteReview).toHaveBeenCalledWith('review-1')
    })
  })

  it('画像付きレビューを表示する', () => {
    const reviewWithImages = {
      ...mockReview,
      images: [
        { id: 'img-1', url: '/image1.jpg' },
        { id: 'img-2', url: '/image2.jpg' },
      ],
    }
    render(<ReviewCard review={reviewWithImages} />)
    const images = document.querySelectorAll('img')
    expect(images.length).toBeGreaterThanOrEqual(2)
  })
})

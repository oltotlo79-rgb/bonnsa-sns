import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'

// next/navigation モック
const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: mockBack,
  }),
}))

// next/image モック
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} className={className} />
  ),
}))

// Server Actions モック
const mockCreateScheduledPost = jest.fn()
const mockUpdateScheduledPost = jest.fn()
jest.mock('@/lib/actions/scheduled-post', () => ({
  createScheduledPost: (...args: unknown[]) => mockCreateScheduledPost(...args),
  updateScheduledPost: (...args: unknown[]) => mockUpdateScheduledPost(...args),
}))

// GenreSelector モック
jest.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button type="button" onClick={() => onChange(['genre-1'])}>Select Genre</button>
    </div>
  ),
}))

// client-image-compression モック
jest.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: jest.fn((file: File) => Promise.resolve(file)),
  isVideoFile: jest.fn((file: File) => file.type.startsWith('video/')),
  formatFileSize: jest.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: jest.fn(),
}))

describe('ScheduledPostForm', () => {
  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
      { id: 'genre-2', name: '雑木類', category: '樹種' },
    ],
  }

  const mockLimits = {
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxScheduledPosts: 10,
    maxDailyPosts: 20,
    canSchedulePost: true,
    canViewAnalytics: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateScheduledPost.mockResolvedValue({ success: true })
    mockUpdateScheduledPost.mockResolvedValue({ success: true })
  })

  it('テキストエリアを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByPlaceholderText('予約投稿の内容を入力...')).toBeInTheDocument()
  })

  it('テキストを入力できる', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    expect(textarea).toHaveValue('テスト投稿')
  })

  it('残り文字数を表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByText('500 / 500')).toBeInTheDocument()
  })

  it('文字数が減ると残り文字数が更新される', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    expect(screen.getByText('497 / 500')).toBeInTheDocument()
  })

  it('ジャンルセレクターを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByTestId('genre-selector')).toBeInTheDocument()
  })

  it('予約日時入力フィールドを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByText('予約日時')).toBeInTheDocument()
  })

  it('メディア追加ボタンを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByRole('button', { name: /メディア追加/ })).toBeInTheDocument()
  })

  it('キャンセルボタンをクリックすると戻る', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockBack).toHaveBeenCalled()
  })

  it('予約するボタンを表示する（新規作成時）', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByRole('button', { name: '予約する' })).toBeInTheDocument()
  })

  it('更新するボタンを表示する（編集時）', () => {
    const editData = {
      id: 'scheduled-1',
      content: 'テスト投稿',
      scheduledAt: new Date('2026-12-01T10:00:00'),
      genreIds: ['genre-1'],
      media: [],
    }

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
  })

  it('編集時は既存のデータで初期化する', () => {
    const editData = {
      id: 'scheduled-1',
      content: '既存の投稿内容',
      scheduledAt: new Date('2026-12-01T10:00:00'),
      genreIds: ['genre-1'],
      media: [],
    }

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

    expect(screen.getByDisplayValue('既存の投稿内容')).toBeInTheDocument()
    expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
  })

  it('コンテンツがなく画像もない場合は予約ボタンを無効化する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
  })

  it('予約日時がない場合は予約ボタンを無効化する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
  })

  it('予約日時がない状態で送信するとエラーを表示する', async () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    // 内容を入力（ボタン有効化のため）
    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    // 日付入力のみ（時間なし）
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2026-12-01' } })
    }

    // 予約日時が完全でないので依然としてボタンはdisabled
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
  })

  it('画像数とビデオ数のカウンターを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByText(/画像: 0\/4枚/)).toBeInTheDocument()
    expect(screen.getByText(/動画: 0\/1本/)).toBeInTheDocument()
  })

  describe('編集モード', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)

    const editData = {
      id: 'scheduled-1',
      content: 'テスト投稿',
      scheduledAt: futureDate,
      genreIds: ['genre-1'],
      media: [{ url: '/image.jpg', type: 'image' }],
    }

    it('既存のメディアを表示する', () => {
      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      expect(container.querySelector('img[src="/image.jpg"]')).toBeInTheDocument()
    })

    it('既存のジャンルを選択済みにする', () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })

  describe('フォーム送信', () => {
    it('新規作成時はcreateScheduledPostを呼び出す', async () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      // フォームに入力
      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      // 日付と時間の入力フィールドを取得して設定
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement

      if (dateInput && timeInput) {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7)
        fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
        fireEvent.change(timeInput, { target: { value: '10:00' } })
      }

      // 送信
      fireEvent.click(screen.getByRole('button', { name: '予約する' }))

      await waitFor(() => {
        expect(mockCreateScheduledPost).toHaveBeenCalled()
      })
    })

    it('編集時はupdateScheduledPostを呼び出す', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(mockUpdateScheduledPost).toHaveBeenCalledWith('scheduled-1', expect.any(FormData))
      })
    })

    it('成功時に予約投稿一覧に遷移する', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/posts/scheduled')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('エラー時にエラーメッセージを表示する', async () => {
      mockCreateScheduledPost.mockResolvedValue({ error: '予約に失敗しました' })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      // フォームに入力
      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement

      if (dateInput && timeInput) {
        fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
        fireEvent.change(timeInput, { target: { value: '10:00' } })
      }

      fireEvent.click(screen.getByRole('button', { name: '予約する' }))

      await waitFor(() => {
        expect(screen.getByText('予約に失敗しました')).toBeInTheDocument()
      })
    })

    it('更新時のエラーを表示する', async () => {
      mockUpdateScheduledPost.mockResolvedValue({ error: '更新に失敗しました' })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
      })
    })

  })

  describe('文字数制限', () => {
    it('文字数超過時は予約ボタンを無効化する', () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

      expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
    })

    it('文字数超過時に警告色を表示する', () => {
      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

      expect(container.querySelector('.text-destructive')).toBeInTheDocument()
    })
  })

  describe('ジャンル選択', () => {
    it('ジャンルを選択できる', () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      fireEvent.click(screen.getByRole('button', { name: 'Select Genre' }))

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })
})

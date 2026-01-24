import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { GenreFilter } from '@/components/search/GenreFilter'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    toString: () => 'q=test',
    getAll: () => [],
  }),
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
    { id: 'genre-2', name: '五葉松', category: '松柏類' },
  ],
  '雑木類': [
    { id: 'genre-3', name: 'もみじ', category: '雑木類' },
  ],
}

describe('GenreFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('ジャンルフィルターボタンを表示する', () => {
    render(<GenreFilter genres={mockGenres} />)
    expect(screen.getByText('ジャンル')).toBeInTheDocument()
  })

  it('クリックでドロップダウンを開く', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
      expect(screen.getByText('黒松')).toBeInTheDocument()
      expect(screen.getByText('五葉松')).toBeInTheDocument()
      expect(screen.getByText('もみじ')).toBeInTheDocument()
    })
  })

  it('カテゴリ別にジャンルをグループ表示する', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('松柏類')).toBeInTheDocument()
      expect(screen.getByText('雑木類')).toBeInTheDocument()
    })
  })

  it('選択されたジャンル数を表示する', () => {
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1', 'genre-2']} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('ジャンルをクリックでURLを更新する', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('黒松')).toBeInTheDocument()
    })

    await user.click(screen.getByText('黒松'))

    expect(mockPush).toHaveBeenCalled()
  })

  it('選択中のジャンルにはスタイルが適用される', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      const genreButton = screen.getByText('黒松')
      expect(genreButton).toHaveClass('bg-primary')
    })
  })

  it('クリアボタンが選択中に表示される', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('クリア')).toBeInTheDocument()
    })
  })
})

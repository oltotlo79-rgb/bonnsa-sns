import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostForm } from '@/components/post/PostForm'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = jest.fn()
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

// Server Actions モック
const mockCreatePost = jest.fn()
jest.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

const mockSaveDraft = jest.fn()
jest.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
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

describe('PostForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('投稿フォームを表示する', () => {
    render(<PostForm genres={mockGenres} />)
    expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
  })

  it('テキスト入力で残り文字数が更新される', async () => {
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    await user.type(textarea, 'テスト投稿')

    // 500 - 5 = 495
    expect(screen.getByText('495')).toBeInTheDocument()
  })

  it('投稿ボタンは空の場合無効', () => {
    render(<PostForm genres={mockGenres} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
  })

  it('テキスト入力で投稿ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')

    expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
  })

  it('投稿送信でServer Actionが呼ばれる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
    })
  })

  it('下書き保存ボタンが表示される', () => {
    render(<PostForm genres={mockGenres} />)
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeInTheDocument()
  })

  it('下書き保存でServer Actionが呼ばれる', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト下書き')
    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })
  })

  it('プレミアム会員の制限が適用される', () => {
    render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 2000, maxImages: 6, maxVideos: 3 }}
      />
    )
    // プレミアムバッジが表示される
    expect(screen.getByText('Premium')).toBeInTheDocument()
  })

  it('投稿エラー時にエラーメッセージを表示する', async () => {
    mockCreatePost.mockResolvedValue({ error: '投稿に失敗しました' })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('投稿に失敗しました')).toBeInTheDocument()
    })
  })

  it('下書き数が表示される', () => {
    render(<PostForm genres={mockGenres} draftCount={3} />)
    expect(screen.getByTitle('下書き一覧')).toBeInTheDocument()
  })
})

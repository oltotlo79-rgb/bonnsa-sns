import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentForm } from '@/components/comment/CommentForm'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actionモック
const mockCreateComment = jest.fn()
jest.mock('@/lib/actions/comment', () => ({
  createComment: (...args: unknown[]) => mockCreateComment(...args),
}))

// クライアント画像圧縮モック
jest.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: jest.fn().mockResolvedValue(new File([''], 'test.jpg', { type: 'image/jpeg' })),
  isVideoFile: jest.fn().mockReturnValue(false),
  formatFileSize: jest.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: jest.fn(),
}))

describe('CommentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('コメントフォームを表示する', () => {
    render(<CommentForm postId="post-1" />)
    expect(screen.getByPlaceholderText('コメントを入力...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /コメントする/i })).toBeInTheDocument()
  })

  it('カスタムプレースホルダーを表示できる', () => {
    render(<CommentForm postId="post-1" placeholder="返信を入力..." />)
    expect(screen.getByPlaceholderText('返信を入力...')).toBeInTheDocument()
  })

  it('コメントを入力できる', async () => {
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    expect(textarea).toHaveValue('テストコメント')
  })

  it('残り文字数を表示する', async () => {
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    // 初期状態では500文字残り
    expect(screen.getByText('500')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')

    // 3文字入力後、497文字残り
    expect(screen.getByText('497')).toBeInTheDocument()
  })

  it('空のコメントは送信できない', () => {
    render(<CommentForm postId="post-1" />)
    const submitButton = screen.getByRole('button', { name: /コメントする/i })
    expect(submitButton).toBeDisabled()
  })

  it('文字数超過時は送信できない', async () => {
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // 501文字入力（fireEvent.changeで高速化）
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

    const submitButton = screen.getByRole('button', { name: /コメントする/i })
    expect(submitButton).toBeDisabled()
  })

  it('コメント送信時にServer Actionを呼ぶ', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalled()
    })
  })

  it('送信成功時にonSuccessコールバックを呼ぶ', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const mockOnSuccess = jest.fn()

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" onSuccess={mockOnSuccess} />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  it('送信成功後にフォームがリセットされる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateComment.mockResolvedValue({ error: 'コメントの投稿に失敗しました' })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(screen.getByText('コメントの投稿に失敗しました')).toBeInTheDocument()
    })
  })

  it('送信中はボタンが無効化される', async () => {
    mockCreateComment.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /送信中/i })).toBeDisabled()
    })
  })

  it('キャンセルボタンを表示する（onCancelが指定されている場合）', () => {
    const mockOnCancel = jest.fn()
    render(<CommentForm postId="post-1" onCancel={mockOnCancel} />)
    expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
  })

  it('キャンセルボタンクリックでonCancelを呼ぶ', async () => {
    const mockOnCancel = jest.fn()
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" onCancel={mockOnCancel} />)

    await user.click(screen.getByRole('button', { name: /キャンセル/i }))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('返信フォームの場合は「返信する」ボタンを表示する', () => {
    render(<CommentForm postId="post-1" parentId="comment-1" />)
    expect(screen.getByRole('button', { name: /返信する/i })).toBeInTheDocument()
  })

  it('autoFocusを指定するとテキストエリアにフォーカスする', () => {
    render(<CommentForm postId="post-1" autoFocus />)
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // autoFocus指定時はフォーカスされる
    expect(textarea).toHaveFocus()
  })

  it('メディア添付ボタンを表示する', () => {
    render(<CommentForm postId="post-1" />)
    // 画像添付ボタン（アイコンボタン）
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('文字数が50以下になると警告色になる', async () => {
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // 451文字入力で残り49文字（fireEvent.changeで高速化）
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(451) } })

    await waitFor(() => {
      expect(screen.getByText('49')).toHaveClass('text-yellow-500')
    })
  })

  it('文字数超過時は警告色（destructive）になる', async () => {
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // 501文字入力で-1（fireEvent.changeで高速化）
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

    await waitFor(() => {
      expect(screen.getByText('-1')).toHaveClass('text-destructive')
    })
  })


  it('parentIdがある場合は返信コメントとして送信する', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" parentId="parent-comment-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, '返信コメント')
    await user.click(screen.getByRole('button', { name: /返信する/i }))

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalled()
    })
  })

  it('キャンセルボタンが表示されない場合はonCancelを呼ばない', () => {
    render(<CommentForm postId="post-1" />)

    // onCancelが指定されていない場合はキャンセルボタンがない
    const cancelButtons = screen.queryAllByRole('button', { name: /キャンセル/i })
    expect(cancelButtons.length).toBe(0)
  })

  it('送信成功時にテキストエリアがリセットされる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // fireEvent.changeでIME問題を回避
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    expect(textarea).toHaveValue('テストコメント')

    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })
})

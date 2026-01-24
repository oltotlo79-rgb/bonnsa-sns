import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostFormModal } from '@/components/post/PostFormModal'

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
  ],
}

const defaultProps = {
  genres: mockGenres,
  isOpen: true,
  onClose: jest.fn(),
}

describe('PostFormModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('モーダルが開いている時フォームを表示する', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
  })

  it('モーダルが閉じている時は何も表示しない', () => {
    render(<PostFormModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByPlaceholderText('いまどうしてる？')).not.toBeInTheDocument()
  })

  it('閉じるボタンクリックでonCloseが呼ばれる', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    // 閉じるボタン（Xアイコン）をクリック
    const closeButton = screen.getAllByRole('button')[0]
    await user.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('投稿ボタンが表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
  })

  it('下書き保存ボタンが表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeInTheDocument()
  })

  it('投稿成功時にonCloseが呼ばれる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const onClose = jest.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('画像/動画追加ボタンが表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByText('画像/動画')).toBeInTheDocument()
  })

  it('下書き数が表示される', () => {
    render(<PostFormModal {...defaultProps} draftCount={5} />)
    expect(screen.getByText('下書き一覧')).toBeInTheDocument()
  })

  it('マイ盆栽選択が表示される', () => {
    const bonsais = [
      { id: 'bonsai-1', name: '黒松一号', species: '黒松' },
    ]
    render(<PostFormModal {...defaultProps} bonsais={bonsais} />)
    expect(screen.getByText('関連する盆栽（任意）')).toBeInTheDocument()
  })
})

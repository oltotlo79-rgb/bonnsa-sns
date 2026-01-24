import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ProfileEditForm } from '@/components/user/ProfileEditForm'

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
    refresh: jest.fn(),
  }),
}))

// Server Actions モック
const mockUpdateProfile = jest.fn()
jest.mock('@/lib/actions/user', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}))

const mockUser = {
  id: 'user-1',
  nickname: 'テストユーザー',
  bio: '自己紹介文',
  location: '東京都',
  avatar_url: null,
  header_url: null,
  bonsai_start_year: 2020,
  bonsai_start_month: 4,
}

describe('ProfileEditForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('フォームを表示する', () => {
    render(<ProfileEditForm user={mockUser} />)
    expect(screen.getByLabelText(/ニックネーム/)).toBeInTheDocument()
    expect(screen.getByLabelText(/自己紹介/)).toBeInTheDocument()
    expect(screen.getByLabelText(/居住地域/)).toBeInTheDocument()
  })

  it('初期値が設定される', () => {
    render(<ProfileEditForm user={mockUser} />)
    expect(screen.getByDisplayValue('テストユーザー')).toBeInTheDocument()
    expect(screen.getByDisplayValue('自己紹介文')).toBeInTheDocument()
  })

  it('保存ボタンが表示される', () => {
    render(<ProfileEditForm user={mockUser} />)
    expect(screen.getByRole('button', { name: '保存する' })).toBeInTheDocument()
  })

  it('送信でServer Actionが呼ばれる', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ProfileEditForm user={mockUser} />)

    await user.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled()
    })
  })

  it('成功時にユーザーページにリダイレクトする', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ProfileEditForm user={mockUser} />)

    await user.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/users/user-1')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockUpdateProfile.mockResolvedValue({ error: '更新に失敗しました' })
    const user = userEvent.setup()
    render(<ProfileEditForm user={mockUser} />)

    await user.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
  })

  it('盆栽歴の入力フィールドがある', () => {
    render(<ProfileEditForm user={mockUser} />)
    expect(screen.getByText('盆栽を始めた時期（任意）')).toBeInTheDocument()
  })

  it('プロフィール画像セクションがある', () => {
    render(<ProfileEditForm user={mockUser} />)
    expect(screen.getByText('プロフィール画像')).toBeInTheDocument()
  })

  it('ヘッダー画像セクションがある', () => {
    render(<ProfileEditForm user={mockUser} />)
    expect(screen.getByText('ヘッダー画像')).toBeInTheDocument()
  })
})

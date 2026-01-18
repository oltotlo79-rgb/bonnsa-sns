import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/LoginForm'

// Next-Auth モック
const mockSignIn = jest.fn()
jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

// Next.js navigation モック
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ヘルパー関数: パスワード入力フィールドを取得
  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')

  it('ログインフォームを表示する', () => {
    render(<LoginForm />)
    expect(getEmailInput()).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const emailInput = getEmailInput()
    await user.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('パスワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const passwordInput = getPasswordInput()
    await user.type(passwordInput, 'password123')
    expect(passwordInput).toHaveValue('password123')
  })

  it('ログインボタンをクリックするとsignInが呼ばれる', async () => {
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
        redirect: false,
      }))
    })
  })

  it('ログイン成功時にフィードページへリダイレクトする', async () => {
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('ログイン失敗時にエラーメッセージを表示する', async () => {
    mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))
    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })
  })

  it('ログイン中はボタンが無効化される', async () => {
    // signInの解決を遅延させる
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100)))
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))

    // ローディング中のボタンテキストを確認
    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeDisabled()
  })

  it('新規登録リンクを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByText(/アカウントをお持ちでない方/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /新規登録/i })).toHaveAttribute('href', '/register')
  })

  it('パスワードリセットリンクを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('link', { name: /パスワードをお忘れですか/i })).toHaveAttribute('href', '/password-reset')
  })

  it('パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const passwordInput = getPasswordInput()

    // 初期状態はパスワードが非表示（type="password"）
    expect(passwordInput).toHaveAttribute('type', 'password')

    // トグルボタンをクリック
    const toggleButton = screen.getByRole('button', { name: /パスワードを表示/i })
    await user.click(toggleButton)

    // パスワードが表示される（type="text"）
    expect(passwordInput).toHaveAttribute('type', 'text')

    // もう一度クリックして非表示に戻す
    const hideButton = screen.getByRole('button', { name: /パスワードを隠す/i })
    await user.click(hideButton)

    // パスワードが非表示に戻る
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('メールアドレスのプレースホルダーが表示される', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('mail@example.com')).toBeInTheDocument()
  })

  it('パスワードのプレースホルダーが表示される', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('8文字以上（英字・数字を含む）')).toBeInTheDocument()
  })
})

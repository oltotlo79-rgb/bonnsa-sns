import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '@/components/auth/RegisterForm'

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
}))

// Server Actionモック
const mockRegisterUser = jest.fn()
jest.mock('@/lib/actions/auth', () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
}))

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ヘルパー関数
  const getNicknameInput = () => screen.getByPlaceholderText('表示名')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')
  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getConfirmPasswordInput = () => screen.getByPlaceholderText('もう一度入力')
  const getTermsCheckbox = () => screen.getByRole('checkbox')
  const getSubmitButton = () => screen.getByRole('button', { name: /新規登録/i })

  it('登録フォームを表示する', () => {
    render(<RegisterForm />)
    expect(getNicknameInput()).toBeInTheDocument()
    expect(getEmailInput()).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()
    expect(getConfirmPasswordInput()).toBeInTheDocument()
    expect(getTermsCheckbox()).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('ニックネームを入力できる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const nicknameInput = getNicknameInput()
    await user.type(nicknameInput, 'テストユーザー')
    expect(nicknameInput).toHaveValue('テストユーザー')
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const emailInput = getEmailInput()
    await user.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('パスワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const passwordInput = getPasswordInput()
    await user.type(passwordInput, 'password123')
    expect(passwordInput).toHaveValue('password123')
  })

  it('利用規約に同意しないと送信ボタンが無効化されている', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')

    // 利用規約に同意していないのでボタンは無効化されている
    expect(getSubmitButton()).toBeDisabled()
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードが一致しない場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'differentpassword')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードが一致しません/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードが8文字未満の場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'pass1')
    await user.type(getConfirmPasswordInput(), 'pass1')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードは8文字以上で入力してください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードに英字がない場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), '12345678')
    await user.type(getConfirmPasswordInput(), '12345678')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードはアルファベットと数字を両方含めてください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードに数字がない場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'abcdefgh')
    await user.type(getConfirmPasswordInput(), 'abcdefgh')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードはアルファベットと数字を両方含めてください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('登録成功時にログインしてフィードページへリダイレクトする', async () => {
    mockRegisterUser.mockResolvedValue({ success: true })
    mockSignIn.mockResolvedValue({ ok: true })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        nickname: 'テストユーザー',
      })
    })

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'test@example.com',
        password: 'password123',
        redirect: false,
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('登録APIがエラーを返した場合エラーメッセージを表示する', async () => {
    mockRegisterUser.mockResolvedValue({ error: 'このメールアドレスは既に登録されています' })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'existing@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/このメールアドレスは既に登録されています/i)).toBeInTheDocument()
    })
  })

  it('ログインに失敗した場合エラーメッセージを表示する', async () => {
    mockRegisterUser.mockResolvedValue({ success: true })
    mockSignIn.mockResolvedValue({ error: 'ログインエラー' })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/登録は完了しましたが、ログインに失敗しました/i)).toBeInTheDocument()
    })
  })

  it('登録中はボタンが無効化される', async () => {
    mockRegisterUser.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))
    mockSignIn.mockResolvedValue({ ok: true })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    expect(screen.getByRole('button', { name: /登録中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登録中/i })).toBeDisabled()
  })

  it('パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const passwordInput = getPasswordInput()

    // 初期状態はパスワードが非表示
    expect(passwordInput).toHaveAttribute('type', 'password')

    // トグルボタンをクリック
    const toggleButton = screen.getAllByRole('button', { name: /パスワードを表示/i })[0]
    await user.click(toggleButton)

    // パスワードが表示される
    expect(passwordInput).toHaveAttribute('type', 'text')

    // もう一度クリックして非表示に戻す
    const hideButton = screen.getAllByRole('button', { name: /パスワードを隠す/i })[0]
    await user.click(hideButton)

    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('確認用パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const confirmPasswordInput = getConfirmPasswordInput()

    // 初期状態はパスワードが非表示
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')

    // トグルボタンをクリック（2番目のトグルボタン）
    const toggleButtons = screen.getAllByRole('button', { name: /パスワードを表示/i })
    await user.click(toggleButtons[1])

    // パスワードが表示される
    expect(confirmPasswordInput).toHaveAttribute('type', 'text')
  })

  it('ログインリンクを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByText(/既にアカウントをお持ちの方/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ログイン/i })).toHaveAttribute('href', '/login')
  })

  it('利用規約リンクを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('link', { name: /利用規約/i })).toHaveAttribute('href', '/terms')
  })

  it('プライバシーポリシーリンクを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('link', { name: /プライバシーポリシー/i })).toHaveAttribute('href', '/privacy')
  })

  it('利用規約に同意しないとボタンが無効化される', () => {
    render(<RegisterForm />)
    expect(getSubmitButton()).toBeDisabled()
  })

  it('利用規約に同意するとボタンが有効化される', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(getTermsCheckbox())
    expect(getSubmitButton()).not.toBeDisabled()
  })
})

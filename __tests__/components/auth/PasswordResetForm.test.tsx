import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

// Server Actionモック
const mockRequestPasswordReset = jest.fn()
jest.mock('@/lib/actions/auth', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}))

describe('PasswordResetForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ヘルパー関数
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')
  const getSubmitButton = () => screen.getByRole('button', { name: /リセットメールを送信/i })

  it('パスワードリセットフォームを表示する', () => {
    render(<PasswordResetForm />)
    expect(screen.getByText(/登録したメールアドレスを入力してください/i)).toBeInTheDocument()
    expect(getEmailInput()).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<PasswordResetForm />)
    const emailInput = getEmailInput()
    await user.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('メールアドレスが空の場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<PasswordResetForm />)

    // フォームを送信（HTML5バリデーションをスキップするためにフォーカスを外す）
    const emailInput = getEmailInput()
    await user.clear(emailInput)
    await user.click(getSubmitButton())

    // HTML5 required属性のため送信されない
    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })

  it('リセットメール送信成功時に成功メッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
    })

    await waitFor(() => {
      expect(screen.getByText(/メールを送信しました/i)).toBeInTheDocument()
      expect(screen.getByText(/パスワードリセット用のリンクを送信しました/i)).toBeInTheDocument()
    })
  })

  it('成功時にフォームが非表示になり成功メッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('mail@example.com')).not.toBeInTheDocument()
      expect(screen.getByText(/メールをご確認ください/i)).toBeInTheDocument()
    })
  })

  it('APIがエラーを返した場合エラーメッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: 'メールアドレスが見つかりません' })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'notfound@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/メールアドレスが見つかりません/i)).toBeInTheDocument()
    })
  })

  it('送信中はボタンが無効化される', async () => {
    mockRequestPasswordReset.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    expect(screen.getByRole('button', { name: /送信中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /送信中/i })).toBeDisabled()
  })

  it('ログインページへのリンクを表示する', () => {
    render(<PasswordResetForm />)
    expect(screen.getByRole('link', { name: /ログインページへ戻る/i })).toHaveAttribute('href', '/login')
  })

  it('成功画面でログインページへのリンクを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ログインページへ戻る/i })).toHaveAttribute('href', '/login')
    })
  })

  it('成功画面で迷惑メールフォルダの確認メッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/迷惑メールフォルダもご確認ください/i)).toBeInTheDocument()
    })
  })

  it('メールアドレスのラベルが表示される', () => {
    render(<PasswordResetForm />)
    expect(screen.getByText('メールアドレス')).toBeInTheDocument()
  })
})

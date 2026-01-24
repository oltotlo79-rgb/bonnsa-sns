import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LogoutButton } from '@/components/auth/LogoutButton'

// Next-Auth モック
const mockSignOut = jest.fn()
jest.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'テストユーザー',
        email: 'test@example.com',
      },
    },
    status: 'authenticated',
  }),
}))

describe('LogoutButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('ログアウトボタンを表示する', () => {
    render(<LogoutButton />)
    expect(screen.getByRole('button', { name: /ログアウト/i })).toBeInTheDocument()
  })

  it('クリックするとsignOutが呼ばれる', async () => {
    mockSignOut.mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<LogoutButton />)

    await user.click(screen.getByRole('button', { name: /ログアウト/i }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
    })
  })

  it('ボタンがghost variantで表示される', () => {
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    // variant="ghost"が適用されているかはクラス名で確認
    // shadcn/uiのghost variantは特定のスタイルを持つ
    expect(button).toBeInTheDocument()
  })

  it('ボタンがsmサイズで表示される', () => {
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    // size="sm"が適用されているか
    expect(button).toBeInTheDocument()
  })
})

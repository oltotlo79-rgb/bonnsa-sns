import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MuteButton } from '@/components/user/MuteButton'

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
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Toast モック
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Server Actionモック
const mockMuteUser = jest.fn()
const mockUnmuteUser = jest.fn()
jest.mock('@/lib/actions/mute', () => ({
  muteUser: (...args: unknown[]) => mockMuteUser(...args),
  unmuteUser: (...args: unknown[]) => mockUnmuteUser(...args),
}))

describe('MuteButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('未ミュート状態でミュートボタンを表示する', () => {
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)
    expect(screen.getByRole('button', { name: /ミュート/i })).toBeInTheDocument()
  })

  it('ミュート済み状態でミュート解除ボタンを表示する', () => {
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={true} />)
    expect(screen.getByRole('button', { name: /ミュート解除/i })).toBeInTheDocument()
  })

  it('ミュートボタンクリックで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })
  })

  it('確認ダイアログでミュートの影響を説明する', async () => {
    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/タイムラインに投稿が表示されなくなります/i)).toBeInTheDocument()
      expect(screen.getByText(/通知が表示されなくなります/i)).toBeInTheDocument()
      expect(screen.getByText(/フォロー関係は維持されます/i)).toBeInTheDocument()
    })
  })

  it('キャンセルボタンでダイアログを閉じる', async () => {
    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText(/テストユーザーさんをミュートしますか/i)).not.toBeInTheDocument()
    })
  })

  it('ミュート実行時にServer Actionを呼ぶ', async () => {
    mockMuteUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ミュート' }))

    await waitFor(() => {
      expect(mockMuteUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('ミュート成功時にトーストを表示する', async () => {
    mockMuteUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ミュート' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'ミュートしました',
      }))
    })
  })

  it('ミュート解除ボタンクリックで直接解除する（確認ダイアログなし）', async () => {
    mockUnmuteUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={true} />)

    await user.click(screen.getByRole('button', { name: /ミュート解除/i }))

    await waitFor(() => {
      expect(mockUnmuteUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('ミュート解除成功時にトーストを表示する', async () => {
    mockUnmuteUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={true} />)

    await user.click(screen.getByRole('button', { name: /ミュート解除/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'ミュートを解除しました',
      }))
    })
  })

  it('エラー時はロールバックしてトーストを表示する', async () => {
    mockMuteUser.mockResolvedValue({ error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ミュート' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'エラー',
        variant: 'destructive',
      }))
    })

    // ロールバック: ミュート解除ではなくミュートボタンが表示される
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^ミュート$/i })).toBeInTheDocument()
    })
  })

  it('ローディング中はボタンが無効化される', async () => {
    mockMuteUser.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ミュート' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '...' })).toBeDisabled()
    })
  })

  it('処理完了後にルーターをリフレッシュする', async () => {
    mockMuteUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MuteButton userId="user-1" nickname="テストユーザー" initialIsMuted={false} />)

    await user.click(screen.getByRole('button', { name: /ミュート/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをミュートしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ミュート' }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })
})

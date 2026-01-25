import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PrivacyToggle } from '@/components/user/PrivacyToggle'

// Server Action モック
const mockUpdatePrivacy = jest.fn()
jest.mock('@/lib/actions/user', () => ({
  updatePrivacy: (...args: unknown[]) => mockUpdatePrivacy(...args),
}))

// useRouter モック
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

describe('PrivacyToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('公開状態で正しいラベルと説明を表示する', () => {
    render(<PrivacyToggle initialIsPublic={true} />)

    expect(screen.getByText('アカウントを公開する')).toBeInTheDocument()
    expect(screen.getByText('誰でもあなたの投稿を閲覧できます')).toBeInTheDocument()
  })

  it('非公開状態で正しい説明を表示する', () => {
    render(<PrivacyToggle initialIsPublic={false} />)

    expect(screen.getByText('フォロワーのみがあなたの投稿を閲覧できます')).toBeInTheDocument()
  })

  it('トグルスイッチが初期状態を反映する（公開）', () => {
    render(<PrivacyToggle initialIsPublic={true} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('data-state', 'checked')
  })

  it('トグルスイッチが初期状態を反映する（非公開）', () => {
    render(<PrivacyToggle initialIsPublic={false} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('data-state', 'unchecked')
  })

  it('トグル変更時にServer Actionを呼び出す', async () => {
    mockUpdatePrivacy.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PrivacyToggle initialIsPublic={true} />)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(mockUpdatePrivacy).toHaveBeenCalledWith(false)
    })
  })

  it('更新成功時にページをリフレッシュする', async () => {
    mockUpdatePrivacy.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PrivacyToggle initialIsPublic={true} />)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('更新成功時に説明文が変わる', async () => {
    mockUpdatePrivacy.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PrivacyToggle initialIsPublic={true} />)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText('フォロワーのみがあなたの投稿を閲覧できます')).toBeInTheDocument()
    })
  })

  it('更新エラー時にエラーメッセージを表示する', async () => {
    mockUpdatePrivacy.mockResolvedValue({ error: '設定の更新に失敗しました' })
    const user = userEvent.setup()
    render(<PrivacyToggle initialIsPublic={true} />)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText('設定の更新に失敗しました')).toBeInTheDocument()
    })
  })

  it('更新エラー時に状態は変わらない', async () => {
    mockUpdatePrivacy.mockResolvedValue({ error: '設定の更新に失敗しました' })
    const user = userEvent.setup()
    render(<PrivacyToggle initialIsPublic={true} />)

    await user.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText('誰でもあなたの投稿を閲覧できます')).toBeInTheDocument()
    })
  })

  it('ローディング中はトグルが無効化される', async () => {
    mockUpdatePrivacy.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    )
    const user = userEvent.setup()
    render(<PrivacyToggle initialIsPublic={true} />)

    await user.click(screen.getByRole('switch'))

    expect(screen.getByRole('switch')).toBeDisabled()
  })
})

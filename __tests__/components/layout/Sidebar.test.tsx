import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '@/components/layout/Sidebar'

// next/image モック
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className, priority }: {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
    priority?: boolean
  }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-priority={priority}
    />
  ),
}))

// next/navigation モック
const mockPathname = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

// next-auth/react モック
const mockSignOut = jest.fn()
jest.mock('next-auth/react', () => ({
  signOut: (options: { callbackUrl: string }) => mockSignOut(options),
}))

// NotificationBadge モック
jest.mock('@/components/notification/NotificationBadge', () => ({
  NotificationBadge: ({ className }: { className?: string }) => (
    <span data-testid="notification-badge" className={className}>3</span>
  ),
}))

// MessageBadge モック
jest.mock('@/components/message/MessageBadge', () => ({
  MessageBadge: ({ className }: { className?: string }) => (
    <span data-testid="message-badge" className={className}>5</span>
  ),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname.mockReturnValue('/feed')
  })

  it('ロゴを表示する', () => {
    const { container } = render(<Sidebar />)

    const logo = container.querySelector('img[alt="BON-LOG"]')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/logo.png')
  })

  it('ロゴにホームへのリンクを設定する', () => {
    render(<Sidebar />)

    const logoLink = screen.getAllByRole('link').find(link =>
      link.querySelector('img[alt="BON-LOG"]')
    )
    expect(logoLink).toHaveAttribute('href', '/feed')
  })

  it('基本ナビゲーション項目を表示する', () => {
    render(<Sidebar />)

    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('メッセージ')).toBeInTheDocument()
    expect(screen.getByText('ブックマーク')).toBeInTheDocument()
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('イベント')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('userIdがある場合はプロフィールリンクを表示する', () => {
    render(<Sidebar userId="user-1" />)

    expect(screen.getByText('プロフィール')).toBeInTheDocument()
    const profileLink = screen.getByRole('link', { name: /プロフィール/ })
    expect(profileLink).toHaveAttribute('href', '/users/user-1')
  })

  it('userIdがない場合はプロフィールリンクを表示しない', () => {
    render(<Sidebar />)

    expect(screen.queryByText('プロフィール')).not.toBeInTheDocument()
  })

  it('isPremiumがtrueの場合はプレミアムメニューを表示する', () => {
    render(<Sidebar isPremium={true} />)

    expect(screen.getByText('予約投稿')).toBeInTheDocument()
    expect(screen.getByText('投稿分析')).toBeInTheDocument()
  })

  it('isPremiumがfalseの場合はプレミアムメニューを表示しない', () => {
    render(<Sidebar isPremium={false} />)

    expect(screen.queryByText('予約投稿')).not.toBeInTheDocument()
    expect(screen.queryByText('投稿分析')).not.toBeInTheDocument()
  })

  it('通知バッジを表示する', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('notification-badge')).toBeInTheDocument()
  })

  it('メッセージバッジを表示する', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('message-badge')).toBeInTheDocument()
  })

  it('ログアウトボタンを表示する', () => {
    render(<Sidebar />)

    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  it('ログアウトボタンをクリックするとsignOutを呼び出す', () => {
    render(<Sidebar />)

    const logoutButton = screen.getByText('ログアウト')
    fireEvent.click(logoutButton)

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('現在のパスと一致するナビゲーションをアクティブにする', () => {
    mockPathname.mockReturnValue('/feed')
    render(<Sidebar />)

    const homeLink = screen.getByRole('link', { name: /ホーム/ })
    expect(homeLink).toHaveClass('bg-primary/10')
  })

  it('子ルートでもナビゲーションをアクティブにする', () => {
    mockPathname.mockReturnValue('/notifications/123')
    render(<Sidebar />)

    const notificationLink = screen.getByRole('link', { name: /通知/ })
    expect(notificationLink).toHaveClass('bg-primary/10')
  })

  it('非アクティブなナビゲーションはアクティブスタイルを持たない', () => {
    mockPathname.mockReturnValue('/feed')
    render(<Sidebar />)

    const searchLink = screen.getByRole('link', { name: /検索/ })
    expect(searchLink).not.toHaveClass('bg-primary/10')
    expect(searchLink).toHaveClass('hover:bg-muted/70')
  })

  it('stickyクラスを適用する', () => {
    const { container } = render(<Sidebar />)

    const aside = container.querySelector('aside')
    expect(aside).toHaveClass('sticky', 'top-0')
  })

  it('lg:flexクラスを適用する（大画面でのみ表示）', () => {
    const { container } = render(<Sidebar />)

    const aside = container.querySelector('aside')
    expect(aside).toHaveClass('hidden', 'lg:flex')
  })

  it('各ナビゲーション項目に正しいhrefを設定する', () => {
    render(<Sidebar userId="user-1" isPremium />)

    expect(screen.getByRole('link', { name: /ホーム/ })).toHaveAttribute('href', '/feed')
    expect(screen.getByRole('link', { name: /検索/ })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: /通知/ })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: /メッセージ/ })).toHaveAttribute('href', '/messages')
    expect(screen.getByRole('link', { name: /ブックマーク/ })).toHaveAttribute('href', '/bookmarks')
    expect(screen.getByRole('link', { name: /マイ盆栽/ })).toHaveAttribute('href', '/bonsai')
    expect(screen.getByRole('link', { name: /盆栽園マップ/ })).toHaveAttribute('href', '/shops')
    expect(screen.getByRole('link', { name: /イベント/ })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /設定/ })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: /予約投稿/ })).toHaveAttribute('href', '/posts/scheduled')
    expect(screen.getByRole('link', { name: /投稿分析/ })).toHaveAttribute('href', '/analytics')
  })

  it('プレミアムメニューに王冠アイコンを表示する', () => {
    const { container } = render(<Sidebar isPremium />)

    // 予約投稿と投稿分析の両方に王冠アイコンがある
    const crownIcons = container.querySelectorAll('.text-amber-500')
    expect(crownIcons.length).toBe(2)
  })
})

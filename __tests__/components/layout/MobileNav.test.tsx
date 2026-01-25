import { render, screen, fireEvent } from '../../utils/test-utils'
import { MobileNav } from '@/components/layout/MobileNav'

// next/navigation モック
const mockPathname = jest.fn()
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
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

describe('MobileNav', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname.mockReturnValue('/feed')
  })

  it('基本ナビゲーション項目を表示する', () => {
    render(<MobileNav />)

    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('メッセージ')).toBeInTheDocument()
    expect(screen.getByText('もっと見る')).toBeInTheDocument()
  })

  it('通知バッジを表示する', () => {
    render(<MobileNav />)

    expect(screen.getByTestId('notification-badge')).toBeInTheDocument()
  })

  it('メッセージバッジを表示する', () => {
    render(<MobileNav />)

    expect(screen.getByTestId('message-badge')).toBeInTheDocument()
  })

  it('もっと見るボタンをクリックするとメニューを表示する', () => {
    render(<MobileNav />)

    // 初期状態ではメニュー項目が表示されない
    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()

    // もっと見るボタンをクリック
    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)

    // メニュー項目が表示される
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('イベント')).toBeInTheDocument()
    expect(screen.getByText('ブックマーク')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('メニュー表示時にフッターリンクを表示する', () => {
    render(<MobileNav />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)

    expect(screen.getByText('利用規約')).toBeInTheDocument()
    expect(screen.getByText('プライバシー')).toBeInTheDocument()
    expect(screen.getByText('特商法表記')).toBeInTheDocument()
    expect(screen.getByText('ヘルプ')).toBeInTheDocument()
  })

  it('userIdがある場合はプロフィールリンクを表示する', () => {
    render(<MobileNav userId="user-1" />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)

    const profileLink = screen.getByRole('link', { name: /プロフィール/ })
    expect(profileLink).toHaveAttribute('href', '/users/user-1')
  })

  it('userIdがない場合はプロフィールリンクが設定ページを指す', () => {
    render(<MobileNav />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)

    const profileLink = screen.getByRole('link', { name: /プロフィール/ })
    expect(profileLink).toHaveAttribute('href', '/settings')
  })

  it('もっと見るボタンを再度クリックするとメニューを閉じる', () => {
    render(<MobileNav />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()

    fireEvent.click(moreButton)
    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()
  })

  it('メニュー外をクリックするとメニューを閉じる', () => {
    render(<MobileNav />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()

    // メニュー外をクリック
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()
  })

  it('現在のパスと一致するナビゲーションをアクティブにする', () => {
    mockPathname.mockReturnValue('/feed')
    render(<MobileNav />)

    const homeLink = screen.getByRole('link', { name: /ホーム/ })
    expect(homeLink).toHaveClass('text-primary')
  })

  it('非アクティブなナビゲーションはアクティブスタイルを持たない', () => {
    mockPathname.mockReturnValue('/feed')
    render(<MobileNav />)

    const searchLink = screen.getByRole('link', { name: /検索/ })
    expect(searchLink).toHaveClass('text-muted-foreground')
  })

  it('もっと見るメニューの項目がアクティブな場合、もっと見るボタンもアクティブになる', () => {
    mockPathname.mockReturnValue('/bonsai')
    render(<MobileNav />)

    const moreButton = screen.getByRole('button')
    expect(moreButton).toHaveClass('text-primary')
  })

  it('lg:hiddenクラスを適用する（モバイルでのみ表示）', () => {
    const { container } = render(<MobileNav />)

    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('lg:hidden')
  })

  it('fixedクラスとz-50を適用する', () => {
    const { container } = render(<MobileNav />)

    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('fixed', 'bottom-0', 'z-50')
  })

  it('各ナビゲーション項目に正しいhrefを設定する', () => {
    render(<MobileNav />)

    expect(screen.getByRole('link', { name: /ホーム/ })).toHaveAttribute('href', '/feed')
    expect(screen.getByRole('link', { name: /検索/ })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: /通知/ })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: /メッセージ/ })).toHaveAttribute('href', '/messages')
  })

  it('メニュー項目に正しいhrefを設定する', () => {
    render(<MobileNav />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)

    expect(screen.getByRole('link', { name: /マイ盆栽/ })).toHaveAttribute('href', '/bonsai')
    expect(screen.getByRole('link', { name: /盆栽園マップ/ })).toHaveAttribute('href', '/shops')
    expect(screen.getByRole('link', { name: /イベント/ })).toHaveAttribute('href', '/events')
    expect(screen.getByRole('link', { name: /ブックマーク/ })).toHaveAttribute('href', '/bookmarks')
    expect(screen.getByRole('link', { name: /設定/ })).toHaveAttribute('href', '/settings')
  })

  it('フッターリンクに正しいhrefを設定する', () => {
    render(<MobileNav />)

    const moreButton = screen.getByText('もっと見る')
    fireEvent.click(moreButton)

    expect(screen.getByRole('link', { name: /利用規約/ })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: /プライバシー/ })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /特商法表記/ })).toHaveAttribute('href', '/tokushoho')
    expect(screen.getByRole('link', { name: /ヘルプ/ })).toHaveAttribute('href', '/help')
  })

  it('子ルートでもナビゲーションをアクティブにする', () => {
    mockPathname.mockReturnValue('/notifications/123')
    render(<MobileNav />)

    const notificationLink = screen.getByRole('link', { name: /通知/ })
    expect(notificationLink).toHaveClass('text-primary')
  })

  it('ユーザープロフィールパスでもっと見るボタンがアクティブになる', () => {
    mockPathname.mockReturnValue('/users/user-1')
    render(<MobileNav userId="user-1" />)

    const moreButton = screen.getByRole('button')
    expect(moreButton).toHaveClass('text-primary')
  })
})

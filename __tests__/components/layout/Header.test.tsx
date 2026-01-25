import { render, screen } from '../../utils/test-utils'
import { Header } from '@/components/layout/Header'

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
    // eslint-disable-next-line @next/next/no-img-element
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

// LogoutButton モック
jest.mock('@/components/auth/LogoutButton', () => ({
  LogoutButton: () => <button>ログアウト</button>,
}))

describe('Header', () => {
  it('ロゴを表示する', () => {
    const { container } = render(<Header />)

    const logo = container.querySelector('img[alt="BON-LOG"]')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/logo.png')
  })

  it('ロゴにホームへのリンクを設定する', () => {
    render(<Header />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/feed')
  })

  it('ログアウトボタンを表示する', () => {
    render(<Header />)

    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  it('userIdがある場合は設定リンクを表示する', () => {
    render(<Header userId="user-1" />)

    const settingsLink = screen.getByRole('link', { name: '' })
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('userIdがない場合は設定リンクを表示しない', () => {
    render(<Header />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1) // ロゴリンクのみ
  })

  it('isPremiumがtrueの場合は王冠アイコンを表示する', () => {
    const { container } = render(<Header isPremium={true} />)

    const crownIcon = container.querySelector('.text-amber-500')
    expect(crownIcon).toBeInTheDocument()
  })

  it('isPremiumがfalseの場合は王冠アイコンを表示しない', () => {
    const { container } = render(<Header isPremium={false} />)

    const crownIcon = container.querySelector('.text-amber-500')
    expect(crownIcon).not.toBeInTheDocument()
  })

  it('デフォルトではプレミアムアイコンを表示しない', () => {
    const { container } = render(<Header />)

    const crownIcon = container.querySelector('.text-amber-500')
    expect(crownIcon).not.toBeInTheDocument()
  })

  it('ヘッダーにstickyクラスを適用する', () => {
    const { container } = render(<Header />)

    expect(container.firstChild).toHaveClass('sticky', 'top-0')
  })

  it('ヘッダーにz-40クラスを適用する', () => {
    const { container } = render(<Header />)

    expect(container.firstChild).toHaveClass('z-40')
  })

  it('ヘッダーにlg:hiddenクラスを適用する', () => {
    const { container } = render(<Header />)

    expect(container.firstChild).toHaveClass('lg:hidden')
  })

  it('ヘッダーにbackdrop-blurクラスを適用する', () => {
    const { container } = render(<Header />)

    expect(container.firstChild).toHaveClass('backdrop-blur-sm')
  })

  it('プレミアムアイコンにtitle属性を設定する', () => {
    render(<Header isPremium={true} />)

    expect(screen.getByTitle('プレミアム会員')).toBeInTheDocument()
  })

  it('ロゴにpriority属性を設定する', () => {
    const { container } = render(<Header />)

    const logo = container.querySelector('img[alt="BON-LOG"]')
    expect(logo).toHaveAttribute('data-priority', 'true')
  })
})

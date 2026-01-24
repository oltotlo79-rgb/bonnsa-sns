import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PricingCard } from '@/components/subscription/PricingCard'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actions モック
const mockCreateCheckoutSession = jest.fn()
jest.mock('@/lib/actions/subscription', () => ({
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
}))

const defaultProps = {
  isPremium: false,
  priceId: 'price_monthly',
  priceType: 'monthly' as const,
  planName: 'プレミアム月額',
  price: 500,
  period: '月',
}

describe('PricingCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('料金カードを表示する', () => {
    render(<PricingCard {...defaultProps} />)
    expect(screen.getByText('プレミアム月額')).toBeInTheDocument()
    expect(screen.getByText('¥500')).toBeInTheDocument()
    expect(screen.getByText('/月')).toBeInTheDocument()
  })

  it('プレミアム機能一覧を表示する', () => {
    render(<PricingCard {...defaultProps} />)
    expect(screen.getByText('投稿文字数 2000文字')).toBeInTheDocument()
    expect(screen.getByText('画像添付 6枚まで')).toBeInTheDocument()
    expect(screen.getByText('動画添付 3本まで')).toBeInTheDocument()
    expect(screen.getByText('予約投稿機能')).toBeInTheDocument()
    expect(screen.getByText('投稿分析ダッシュボード')).toBeInTheDocument()
  })

  it('登録ボタンを表示する', () => {
    render(<PricingCard {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'プレミアムに登録' })).toBeInTheDocument()
  })

  it('プレミアム会員には「現在ご利用中」を表示', () => {
    render(<PricingCard {...defaultProps} isPremium={true} />)
    expect(screen.getByRole('button', { name: '現在ご利用中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現在ご利用中' })).toBeDisabled()
  })

  it('おすすめバッジを表示する', () => {
    render(<PricingCard {...defaultProps} popular={true} />)
    expect(screen.getByText('おすすめ')).toBeInTheDocument()
  })

  it('説明文を表示する', () => {
    render(<PricingCard {...defaultProps} description="お得な月額プラン" />)
    expect(screen.getByText('お得な月額プラン')).toBeInTheDocument()
  })

  it('登録ボタンクリックでチェックアウトセッションを作成', async () => {
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/xxx' })
    const user = userEvent.setup()
    render(<PricingCard {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'プレミアムに登録' }))

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith('monthly')
    })
  })

  it('チェックアウトURLへのリダイレクトを試みる', async () => {
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/xxx' })
    const user = userEvent.setup()
    render(<PricingCard {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'プレミアムに登録' }))

    // Server Actionが呼ばれてURLが返されることを確認
    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith('monthly')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateCheckoutSession.mockResolvedValue({ error: '決済の開始に失敗しました' })
    const user = userEvent.setup()
    render(<PricingCard {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'プレミアムに登録' }))

    await waitFor(() => {
      expect(screen.getByText('決済の開始に失敗しました')).toBeInTheDocument()
    })
  })

  it('年額プランを表示する', () => {
    render(
      <PricingCard
        {...defaultProps}
        priceType="yearly"
        planName="プレミアム年額"
        price={5000}
        period="年"
      />
    )
    expect(screen.getByText('プレミアム年額')).toBeInTheDocument()
    expect(screen.getByText('¥5,000')).toBeInTheDocument()
    expect(screen.getByText('/年')).toBeInTheDocument()
  })
})

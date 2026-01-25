import { render, screen } from '@testing-library/react'
import { MessageBadge } from '@/components/message/MessageBadge'

// Server Action モック
const mockGetUnreadMessageCount = jest.fn()
jest.mock('@/lib/actions/message', () => ({
  getUnreadMessageCount: () => mockGetUnreadMessageCount(),
}))

// React Query モック - 完全なモック
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => {
    const result = mockGetUnreadMessageCount()
    return { data: result }
  },
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('MessageBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('未読メッセージ数を表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('未読が0件の場合は何も表示しない', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 0 })
    const { container } = render(<MessageBadge />)

    expect(container.firstChild).toBeNull()
  })

  it('100件以上は99+と表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 150 })
    render(<MessageBadge />)

    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('99件は99と表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 99 })
    render(<MessageBadge />)

    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('1件の未読を表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 1 })
    render(<MessageBadge />)

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('カスタムクラスを適用する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge className="absolute -top-1 -right-1" />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('absolute', '-top-1', '-right-1')
  })

  it('赤い背景色が適用される', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('bg-red-500')
  })

  it('白いテキスト色が適用される', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('text-white')
  })

  it('データがundefinedの場合は何も表示しない', () => {
    mockGetUnreadMessageCount.mockReturnValue(undefined)
    const { container } = render(<MessageBadge />)

    expect(container.firstChild).toBeNull()
  })
})

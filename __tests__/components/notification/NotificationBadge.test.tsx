import { render, screen } from '../../utils/test-utils'

// useQueryモック（QueryClientは実際の実装を保持）
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: jest.fn(),
  }
})

// Server Action モック（Prisma依存を回避）
jest.mock('@/lib/actions/notification', () => ({
  getUnreadCount: jest.fn(),
}))

import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { useQuery } from '@tanstack/react-query'

const mockUseQuery = useQuery as jest.Mock

describe('NotificationBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('未読数が0の場合は何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: { count: 0 } })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('未読数を表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('未読数が100以上の場合は99+と表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 150 } })

    render(<NotificationBadge />)

    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('未読数がちょうど99の場合は99と表示する', () => {
    mockUseQuery.mockReturnValue({ data: { count: 99 } })

    render(<NotificationBadge />)

    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('classNameを適用できる', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge className="custom-class" />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('custom-class')
  })

  it('バッジは赤い背景色を持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('bg-red-500')
  })

  it('バッジは丸みを持つ', () => {
    mockUseQuery.mockReturnValue({ data: { count: 5 } })

    render(<NotificationBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('rounded-full')
  })

  it('データ取得失敗時は0として扱い何も表示しない', () => {
    mockUseQuery.mockReturnValue({ data: {} })

    const { container } = render(<NotificationBadge />)

    expect(container.querySelector('span')).not.toBeInTheDocument()
  })
})

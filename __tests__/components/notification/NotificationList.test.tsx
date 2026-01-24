import { render, screen, waitFor } from '../../utils/test-utils'
import { NotificationList } from '@/components/notification/NotificationList'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// React Query モック
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn().mockReturnValue({
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: jest.fn(),
}))

// intersection-observer モック
jest.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: jest.fn(), inView: false }),
}))

// Server Actions モック
const mockMarkAllAsRead = jest.fn()
jest.mock('@/lib/actions/notification', () => ({
  getNotifications: jest.fn(),
  markAllAsRead: () => mockMarkAllAsRead(),
  markAsRead: jest.fn(),
}))

describe('NotificationList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMarkAllAsRead.mockResolvedValue({ success: true })
  })

  it('通知がない場合メッセージを表示する', () => {
    render(<NotificationList initialNotifications={[]} />)
    expect(screen.getByText('通知はありません')).toBeInTheDocument()
    expect(screen.getByText(/いいね、コメント、フォローなどの通知がここに表示されます/)).toBeInTheDocument()
  })

  it('自動的にmarkAllAsReadを呼ぶ', async () => {
    render(<NotificationList initialNotifications={[]} />)

    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalled()
    })
  })
})

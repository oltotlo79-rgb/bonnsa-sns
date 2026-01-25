import { render, screen } from '../../utils/test-utils'
import { EventList } from '@/components/event/EventList'

// EventCard モック
jest.mock('@/components/event/EventCard', () => ({
  EventCard: ({ event }: { event: { id: string; title: string } }) => (
    <div data-testid={`event-${event.id}`}>{event.title}</div>
  ),
}))

describe('EventList', () => {
  const mockEvents = [
    {
      id: 'event-1',
      title: '盆栽展示会',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-03-03'),
      prefecture: '東京都',
      city: '渋谷区',
      venue: '盆栽会館',
      admissionFee: '500円',
      hasSales: true,
    },
    {
      id: 'event-2',
      title: '盆栽ワークショップ',
      startDate: new Date('2024-03-15'),
      endDate: null,
      prefecture: '大阪府',
      city: '大阪市',
      venue: null,
      admissionFee: '無料',
      hasSales: false,
    },
    {
      id: 'event-3',
      title: '春の盆栽市',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-04-02'),
      prefecture: null,
      city: null,
      venue: null,
      admissionFee: null,
      hasSales: true,
    },
  ]

  it('イベント一覧を表示する', () => {
    render(<EventList events={mockEvents} />)

    expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
    expect(screen.getByTestId('event-event-2')).toBeInTheDocument()
    expect(screen.getByTestId('event-event-3')).toBeInTheDocument()
  })

  it('各イベントのタイトルを表示する', () => {
    render(<EventList events={mockEvents} />)

    expect(screen.getByText('盆栽展示会')).toBeInTheDocument()
    expect(screen.getByText('盆栽ワークショップ')).toBeInTheDocument()
    expect(screen.getByText('春の盆栽市')).toBeInTheDocument()
  })

  it('イベントが0件の場合はデフォルトの空メッセージを表示する', () => {
    render(<EventList events={[]} />)

    expect(screen.getByText('イベントがありません')).toBeInTheDocument()
  })

  it('カスタム空メッセージを表示する', () => {
    render(<EventList events={[]} emptyMessage="該当するイベントが見つかりません" />)

    expect(screen.getByText('該当するイベントが見つかりません')).toBeInTheDocument()
  })

  it('イベントが1件の場合も正しく表示する', () => {
    render(<EventList events={[mockEvents[0]]} />)

    expect(screen.getByTestId('event-event-1')).toBeInTheDocument()
    expect(screen.queryByText('イベントがありません')).not.toBeInTheDocument()
  })

  it('グリッドレイアウトが適用される', () => {
    const { container } = render(<EventList events={mockEvents} />)

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
  })

  it('レスポンシブクラスが適用される', () => {
    const { container } = render(<EventList events={mockEvents} />)

    const grid = container.querySelector('.grid')
    expect(grid).toHaveClass('sm:grid-cols-2')
    expect(grid).toHaveClass('lg:grid-cols-1')
    expect(grid).toHaveClass('xl:grid-cols-2')
  })

  it('空の場合はグリッドを表示しない', () => {
    const { container } = render(<EventList events={[]} />)

    expect(container.querySelector('.grid')).not.toBeInTheDocument()
  })
})

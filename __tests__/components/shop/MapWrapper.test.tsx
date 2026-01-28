/**
 * マップラッパーコンポーネントのテスト
 *
 * @module __tests__/components/shop/MapWrapper.test
 */

import { render, screen, waitFor } from '../../utils/test-utils'

// Mapコンポーネントをモック（動的インポートの代わり）
jest.mock('@/components/shop/Map', () => ({
  Map: ({ shops }: { shops: unknown[] }) => (
    <div data-testid="mock-map">店舗数: {shops.length}</div>
  ),
}))

// next/dynamicをモック
jest.mock('next/dynamic', () => {
  return function dynamic(loader: () => Promise<{ default: React.ComponentType }>) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const component = require('@/components/shop/Map')
    return component.Map
  }
})

import { MapWrapper } from '@/components/shop/MapWrapper'

const mockShops = [
  {
    id: 'shop-1',
    name: 'テスト盆栽園',
    address: '東京都渋谷区1-2-3',
    latitude: 35.6762,
    longitude: 139.6503,
  },
]

describe('MapWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('マップコンポーネントを表示する', async () => {
    render(<MapWrapper shops={mockShops} />)

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })

  it('店舗情報をMapコンポーネントに渡す', async () => {
    render(<MapWrapper shops={mockShops} />)

    await waitFor(() => {
      expect(screen.getByText('店舗数: 1')).toBeInTheDocument()
    })
  })

  it('空の店舗リストでも動作する', async () => {
    render(<MapWrapper shops={[]} />)

    await waitFor(() => {
      expect(screen.getByText('店舗数: 0')).toBeInTheDocument()
    })
  })

  it('centerとzoomプロパティを受け入れる', async () => {
    render(
      <MapWrapper
        shops={mockShops}
        center={[35.0, 135.0]}
        zoom={15}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })
})

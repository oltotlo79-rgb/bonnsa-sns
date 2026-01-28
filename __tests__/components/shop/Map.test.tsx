/**
 * 盆栽園マップコンポーネントのテスト
 *
 * @module __tests__/components/shop/Map.test
 */

import { render, screen } from '../../utils/test-utils'

// Leafletのモック
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({
    setView: jest.fn(),
    locate: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
}))

jest.mock('leaflet', () => ({
  divIcon: jest.fn(() => ({})),
  icon: jest.fn(() => ({})),
  latLng: jest.fn((lat, lng) => [lat, lng]),
  LatLng: jest.fn(),
}))

// 動的インポートをモック
jest.mock('leaflet/dist/leaflet.css', () => ({}))

import { Map } from '@/components/shop/Map'

const mockShops = [
  {
    id: 'shop-1',
    name: 'テスト盆栽園',
    address: '東京都渋谷区1-2-3',
    latitude: 35.6762,
    longitude: 139.6503,
    averageRating: 4.5,
    reviewCount: 10,
  },
  {
    id: 'shop-2',
    name: 'もう一つの盆栽園',
    address: '東京都新宿区4-5-6',
    latitude: 35.6895,
    longitude: 139.6917,
    averageRating: 4.0,
    reviewCount: 5,
  },
]

describe('Map', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('マップコンテナを表示する', () => {
    render(<Map shops={mockShops} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('タイルレイヤーを表示する', () => {
    render(<Map shops={mockShops} />)
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
  })

  it('店舗ごとにマーカーを表示する', () => {
    render(<Map shops={mockShops} />)
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(mockShops.length)
  })

  it('空の店舗リストでもマップが表示される', () => {
    render(<Map shops={[]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('centerプロパティを受け入れる', () => {
    const customCenter: [number, number] = [35.0, 135.0]
    render(<Map shops={mockShops} center={customCenter} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('zoomプロパティを受け入れる', () => {
    render(<Map shops={mockShops} zoom={15} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })
})

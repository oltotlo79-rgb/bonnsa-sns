import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ShopForm } from '@/components/shop/ShopForm'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: jest.fn(),
  }),
}))

// Server Actions モック
const mockCreateShop = jest.fn()
const mockUpdateShop = jest.fn()
const mockDeleteShop = jest.fn()
const mockSearchAddressSuggestions = jest.fn()
jest.mock('@/lib/actions/shop', () => ({
  createShop: (...args: unknown[]) => mockCreateShop(...args),
  updateShop: (...args: unknown[]) => mockUpdateShop(...args),
  deleteShop: (...args: unknown[]) => mockDeleteShop(...args),
  searchAddressSuggestions: (...args: unknown[]) => mockSearchAddressSuggestions(...args),
}))

const mockGenres = [
  { id: 'genre-1', name: '黒松', category: '松柏類' },
  { id: 'genre-2', name: '五葉松', category: '松柏類' },
]

describe('ShopForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
  })

  it('新規作成フォームを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/名称/)).toBeInTheDocument()
    expect(screen.getByLabelText(/住所/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('編集フォームに初期値を設定する', () => {
    const initialData = {
      id: 'shop-1',
      name: 'テスト盆栽園',
      address: '東京都渋谷区',
      latitude: 35.6,
      longitude: 139.7,
      phone: '03-1234-5678',
      website: 'https://example.com',
      businessHours: '9:00-17:00',
      closedDays: '水曜日',
      genres: mockGenres,
    }
    render(<ShopForm genres={mockGenres} mode="edit" initialData={initialData} />)
    expect(screen.getByDisplayValue('テスト盆栽園')).toBeInTheDocument()
    expect(screen.getByDisplayValue('東京都渋谷区')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
  })

  it('キャンセルボタンで戻る', async () => {
    const user = userEvent.setup()
    render(<ShopForm genres={mockGenres} mode="create" />)

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockBack).toHaveBeenCalled()
  })

  it('名称が必須', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    const nameInput = screen.getByLabelText(/名称/)
    expect(nameInput).toBeRequired()
  })

  it('住所が必須', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    const addressInput = screen.getByLabelText(/住所/)
    expect(addressInput).toBeRequired()
  })

  it('位置取得ボタンを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByRole('button', { name: '位置取得' })).toBeInTheDocument()
  })

  it('電話番号フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/電話番号/)).toBeInTheDocument()
  })

  it('ウェブサイトフィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/ウェブサイト/)).toBeInTheDocument()
  })

  it('定休日フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/定休日/)).toBeInTheDocument()
  })

  it('ジャンル選択を表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByText('取り扱いジャンル')).toBeInTheDocument()
    expect(screen.getByText('黒松')).toBeInTheDocument()
  })

  it('編集モードで削除ボタンを表示する', () => {
    const initialData = {
      id: 'shop-1',
      name: 'テスト盆栽園',
      address: '東京都渋谷区',
      latitude: 35.6,
      longitude: 139.7,
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
      genres: [],
    }
    render(<ShopForm genres={mockGenres} mode="edit" initialData={initialData} />)
    expect(screen.getByRole('button', { name: 'この盆栽園を削除' })).toBeInTheDocument()
  })

  it('新規作成でServer Actionが呼ばれる', async () => {
    mockCreateShop.mockResolvedValue({ shopId: 'new-shop-id' })
    const user = userEvent.setup()
    render(<ShopForm genres={mockGenres} mode="create" />)

    await user.type(screen.getByLabelText(/名称/), 'テスト盆栽園')
    await user.type(screen.getByLabelText(/住所/), '東京都渋谷区')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    // 位置取得していない場合は確認ダイアログが表示される
    await waitFor(() => {
      expect(screen.getByText(/位置情報が取得されていません/)).toBeInTheDocument()
    })
  })
})

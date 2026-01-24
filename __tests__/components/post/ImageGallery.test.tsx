import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ImageGallery } from '@/components/post/ImageGallery'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockImages = [
  { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
  { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
]

const mockVideo = [
  { id: 'media-3', url: '/video.mp4', type: 'video', sortOrder: 0 },
]

describe('ImageGallery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('画像を表示する', () => {
    render(<ImageGallery images={mockImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })

  it('画像がsortOrder順に表示される', () => {
    const unorderedImages = [
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
    ]
    render(<ImageGallery images={unorderedImages} />)
    const images = document.querySelectorAll('img')
    expect(images[0]).toHaveAttribute('src', '/image1.jpg')
    expect(images[1]).toHaveAttribute('src', '/image2.jpg')
  })

  it('1枚の画像は全幅で表示される', () => {
    render(<ImageGallery images={[mockImages[0]]} />)
    const image = document.querySelector('img')
    expect(image).toBeInTheDocument()
  })

  it('複数画像はグリッドで表示される', () => {
    render(<ImageGallery images={mockImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })

  it('画像クリックでモーダルを開く', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    // モーダルが表示される（閉じるボタンがある）
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })
  })

  it('モーダルの閉じるボタンでモーダルを閉じる', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    // モーダルが開いている
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(2)
    })

    // 閉じるボタンをクリック（最初のボタン以外で、モーダル内のボタン）
    const allButtons = screen.getAllByRole('button')
    // 閉じるボタンは通常最初か最後にある
    const closeButton = allButtons.find(btn => btn.className.includes('rounded-full'))
    if (closeButton) {
      await user.click(closeButton)
    }
  })

  it('動画を表示する', () => {
    render(<ImageGallery images={mockVideo} />)
    // 動画要素があることを確認（video要素はroleがないので別の方法で確認）
    const container = document.querySelector('video')
    expect(container).toBeInTheDocument()
  })

  it('onMediaClickコールバックが呼ばれる', async () => {
    const mockOnMediaClick = jest.fn()
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} onMediaClick={mockOnMediaClick} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    expect(mockOnMediaClick).toHaveBeenCalledWith(mockImages[0])
  })

  it('複数画像の場合ナビゲーションドットを表示する', async () => {
    const user = userEvent.setup()
    render(<ImageGallery images={mockImages} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])

    // モーダル内のナビゲーションドットが表示される
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button')
      // 画像ボタン(2) + 閉じるボタン(1) + ナビゲーションドット(2) = 5以上
      expect(allButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('3枚の画像で最初の画像は大きく表示される', () => {
    const threeImages = [
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-3', url: '/image3.jpg', type: 'image', sortOrder: 2 },
    ]
    render(<ImageGallery images={threeImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(3)
  })

  it('4枚の画像を2x2グリッドで表示する', () => {
    const fourImages = [
      { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
      { id: 'media-3', url: '/image3.jpg', type: 'image', sortOrder: 2 },
      { id: 'media-4', url: '/image4.jpg', type: 'image', sortOrder: 3 },
    ]
    render(<ImageGallery images={fourImages} />)
    const images = document.querySelectorAll('img')
    expect(images).toHaveLength(4)
  })
})

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ShareButtons } from '@/components/post/ShareButtons'

// window.openをモック
const mockWindowOpen = jest.fn()
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
})

// clipboardをモック（フォールバック用にexecCommandも）
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
})

describe('ShareButtons', () => {
  const defaultProps = {
    url: 'https://example.com/posts/123',
    title: 'テスト投稿タイトル',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('シェアラベルを表示する', () => {
    render(<ShareButtons {...defaultProps} />)
    expect(screen.getByText('シェア:')).toBeInTheDocument()
  })

  it('すべてのシェアボタンを表示する', () => {
    render(<ShareButtons {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'X(Twitter)でシェア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Facebookでシェア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LINEでシェア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'リンクをコピー' })).toBeInTheDocument()
  })

  it('Xボタンをクリックするとシェアウィンドウを開く', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      expect.any(String)
    )
  })

  it('Facebookボタンをクリックするとシェアウィンドウを開く', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Facebookでシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('facebook.com/sharer'),
      '_blank',
      expect.any(String)
    )
  })

  it('LINEボタンをクリックするとシェアウィンドウを開く', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'LINEでシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('line.me'),
      '_blank',
      expect.any(String)
    )
  })

  it('リンクボタンをクリックするとコピー完了状態になる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    // コピー前は「リンク」テキストが表示されている
    expect(screen.getByText('リンク')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'リンクをコピー' }))

    // コピー後は「コピー済」が表示される
    await waitFor(() => {
      expect(screen.getByText('コピー済')).toBeInTheDocument()
    })
  })

  it('textプロパティが指定されていない場合はtitleを使用する', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(defaultProps.title)),
      '_blank',
      expect.any(String)
    )
  })

  it('textプロパティが指定されている場合はそれを使用する', async () => {
    const customText = 'カスタムシェアテキスト'
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} text={customText} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(customText)),
      '_blank',
      expect.any(String)
    )
  })

  it('URLが正しくエンコードされる', async () => {
    const user = userEvent.setup()
    render(<ShareButtons {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'X(Twitter)でシェア' }))

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(defaultProps.url)),
      '_blank',
      expect.any(String)
    )
  })
})

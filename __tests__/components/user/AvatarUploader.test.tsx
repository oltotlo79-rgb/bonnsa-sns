import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { AvatarUploader } from '@/components/user/AvatarUploader'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
}))

describe('AvatarUploader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('アップロードボタンを表示する', () => {
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)
    expect(screen.getByRole('button', { name: /画像を変更/ })).toBeInTheDocument()
  })

  it('現在のアバターがない場合はイニシャルを表示', () => {
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('ファイル形式の説明を表示する', () => {
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)
    expect(screen.getByText(/JPEG、PNG、WebP形式/)).toBeInTheDocument()
  })

  it('ファイル入力がhidden', () => {
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveClass('hidden')
  })

  it('ボタンクリックでファイル選択を開く', async () => {
    const user = userEvent.setup()
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = jest.spyOn(fileInput, 'click')

    await user.click(screen.getByRole('button', { name: /画像を変更/ }))

    expect(clickSpy).toHaveBeenCalled()
  })

  it('accept属性が正しい画像形式を指定', () => {
    render(<AvatarUploader currentUrl={null} nickname="テスト" />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  })
})

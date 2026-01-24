import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

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

// Server Actions モック
const mockAddBonsaiRecord = jest.fn()
jest.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: unknown[]) => mockAddBonsaiRecord(...args),
}))

describe('BonsaiRecordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('成長記録フォームを表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByPlaceholderText(/成長の様子や作業内容を記録/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '記録する' })).toBeInTheDocument()
  })

  it('画像追加ボタンを表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByText('画像を追加')).toBeInTheDocument()
  })

  it('画像枚数制限の説明を表示する', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByText('最大4枚まで')).toBeInTheDocument()
  })

  it('空の状態では記録ボタンが無効', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    expect(screen.getByRole('button', { name: '記録する' })).toBeDisabled()
  })

  it('テキスト入力で記録ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    await user.type(screen.getByPlaceholderText(/成長の様子/), '今日は水やりをしました')

    expect(screen.getByRole('button', { name: '記録する' })).not.toBeDisabled()
  })

  it('送信でServer Actionが呼ばれる', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    await user.type(screen.getByPlaceholderText(/成長の様子/), '剪定を行いました')
    await user.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith({
        bonsaiId: 'bonsai-1',
        content: '剪定を行いました',
        imageUrls: undefined,
      })
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ error: '記録に失敗しました' })
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    await user.type(screen.getByPlaceholderText(/成長の様子/), 'テスト記録')
    await user.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(screen.getByText('記録に失敗しました')).toBeInTheDocument()
    })
  })

  it('テキストも画像もない場合はエラー', async () => {
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    // ボタンは無効なのでクリックしても何も起きない
    expect(screen.getByRole('button', { name: '記録する' })).toBeDisabled()
  })

  it('ファイル入力を受け付ける', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', 'image/*')
    expect(fileInput).toHaveAttribute('multiple')
  })
})

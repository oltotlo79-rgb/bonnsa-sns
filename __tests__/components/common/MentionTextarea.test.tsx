/**
 * MentionTextareaコンポーネントのテスト
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionTextarea } from '@/components/common/MentionTextarea'

// searchMentionUsersのモック
const mockSearchMentionUsers = jest.fn()
jest.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: (...args: unknown[]) => mockSearchMentionUsers(...args),
}))

describe('MentionTextarea', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    placeholder: 'テスト入力',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ============================================================
  // 基本的なレンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('テキストエリアがレンダリングされる', () => {
      render(<MentionTextarea {...defaultProps} />)
      expect(screen.getByPlaceholderText('テスト入力')).toBeInTheDocument()
    })

    it('初期値が表示される', () => {
      render(<MentionTextarea {...defaultProps} value="初期テキスト" />)
      expect(screen.getByDisplayValue('初期テキスト')).toBeInTheDocument()
    })

    it('disabledの場合、テキストエリアが無効化される', () => {
      render(<MentionTextarea {...defaultProps} disabled />)
      expect(screen.getByPlaceholderText('テスト入力')).toBeDisabled()
    })

    it('maxLengthが設定される', () => {
      render(<MentionTextarea {...defaultProps} maxLength={100} />)
      expect(screen.getByPlaceholderText('テスト入力')).toHaveAttribute('maxLength', '100')
    })

    it('rowsが設定される', () => {
      render(<MentionTextarea {...defaultProps} rows={5} />)
      expect(screen.getByPlaceholderText('テスト入力')).toHaveAttribute('rows', '5')
    })

    it('classNameが適用される', () => {
      render(<MentionTextarea {...defaultProps} className="custom-class" />)
      expect(screen.getByPlaceholderText('テスト入力').closest('textarea')).toHaveClass('custom-class')
    })
  })

  // ============================================================
  // テキスト入力
  // ============================================================

  describe('テキスト入力', () => {
    it('テキスト入力でonChangeが呼ばれる', async () => {
      const onChange = jest.fn()
      render(<MentionTextarea {...defaultProps} onChange={onChange} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: 'Hello', selectionStart: 5 } })

      expect(onChange).toHaveBeenCalledWith('Hello')
    })

    it('通常のテキスト入力では候補が表示されない', async () => {
      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: 'Hello World', selectionStart: 11 } })

      // デバウンス時間を進める
      act(() => {
        jest.advanceTimersByTime(400)
      })

      expect(mockSearchMentionUsers).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // メンション候補表示
  // ============================================================

  describe('メンション候補表示', () => {
    it('@入力で検索が実行される', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      // デバウンス時間を進める
      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockSearchMentionUsers).toHaveBeenCalledWith('j', 8)
      })
    })

    it('候補がある場合、ドロップダウンが表示される', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
        { id: 'user2', nickname: 'jane', avatarUrl: null, isFollowing: true },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
        expect(screen.getByText('@jane')).toBeInTheDocument()
      })
    })

    it('フォロー中ユーザーにはバッジが表示される', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: true },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('フォロー中')).toBeInTheDocument()
      })
    })

    it('候補がない場合、ドロップダウンは表示されない', async () => {
      mockSearchMentionUsers.mockResolvedValue([])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@xyz', selectionStart: 4 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      })
    })

    it('文中の@でも候補が表示される', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'test', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      // "Hello @t" で@tが検索される
      fireEvent.change(textarea, { target: { value: 'Hello @t', selectionStart: 8 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockSearchMentionUsers).toHaveBeenCalledWith('t', 8)
      })
    })
  })

  // ============================================================
  // キーボード操作
  // ============================================================

  describe('キーボード操作', () => {
    beforeEach(() => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
        { id: 'user2', nickname: 'jane', avatarUrl: null, isFollowing: false },
      ])
    })

    it('Escapeキーで候補を閉じる', async () => {
      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      fireEvent.keyDown(textarea, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByText('@john')).not.toBeInTheDocument()
      })
    })

    it('ArrowDownで次の候補を選択', async () => {
      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      // 最初はjohnが選択されている（インデックス0）
      // ArrowDownでjaneが選択される（インデックス1）
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })

      // 選択された候補にはbg-mutedクラスがつく
      const janeButton = screen.getByText('@jane').closest('button')
      expect(janeButton).toHaveClass('bg-muted')
    })

    it('ArrowUpで前の候補を選択', async () => {
      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      // ArrowUpで最後の候補（jane）が選択される（ラップアラウンド）
      fireEvent.keyDown(textarea, { key: 'ArrowUp' })

      const janeButton = screen.getByText('@jane').closest('button')
      expect(janeButton).toHaveClass('bg-muted')
    })
  })

  // ============================================================
  // ユーザー選択
  // ============================================================

  describe('ユーザー選択', () => {
    it('クリックでユーザーを選択し、メンションが挿入される', async () => {
      const onChange = jest.fn()
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} onChange={onChange} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      // ユーザーをクリック
      fireEvent.click(screen.getByText('@john'))

      // <@user1> 形式で挿入される
      expect(onChange).toHaveBeenCalledWith('<@user1> ')
    })

    it('Enterキーで選択中のユーザーを選択', async () => {
      const onChange = jest.fn()
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} onChange={onChange} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(onChange).toHaveBeenCalledWith('<@user1> ')
    })

    it('Tabキーで選択中のユーザーを選択', async () => {
      const onChange = jest.fn()
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} onChange={onChange} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      fireEvent.keyDown(textarea, { key: 'Tab' })

      expect(onChange).toHaveBeenCalledWith('<@user1> ')
    })

    it('選択後、ドロップダウンが閉じる', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('@john'))

      await waitFor(() => {
        expect(screen.queryByText('@john')).not.toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('@だけ入力するとフォロー中ユーザーを検索する', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'following-1', nickname: 'followingUser', avatarUrl: null, isFollowing: true },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      expect(mockSearchMentionUsers).toHaveBeenCalledWith('', 8)
    })

    it('@の後にスペースがある場合は検索しない', async () => {
      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@ ', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      expect(mockSearchMentionUsers).not.toHaveBeenCalled()
    })

    it('検索エラーが発生しても候補は表示されない', async () => {
      mockSearchMentionUsers.mockRejectedValue(new Error('Search error'))

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockSearchMentionUsers).toHaveBeenCalled()
      })

      // エラー後も候補は表示されない
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('アバター画像がある場合は表示される', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: '/avatar.jpg', isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        const avatar = screen.getByAltText('john')
        expect(avatar).toBeInTheDocument()
        expect(avatar).toHaveAttribute('src', expect.stringContaining('avatar.jpg'))
      })
    })
  })

  // ============================================================
  // ヒント表示
  // ============================================================

  describe('ヒント表示', () => {
    it('候補表示時にキーボードヒントが表示される', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, { target: { value: '@j', selectionStart: 2 } })

      act(() => {
        jest.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('↑↓ 選択')).toBeInTheDocument()
        expect(screen.getByText('Enter 確定')).toBeInTheDocument()
        expect(screen.getByText('Esc 閉じる')).toBeInTheDocument()
      })
    })
  })
})

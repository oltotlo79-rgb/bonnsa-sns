import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentCard } from '@/components/comment/CommentCard'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Actions モック
const mockDeleteComment = jest.fn()
const mockGetReplies = jest.fn()
jest.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
}))

// いいねアクションモック
jest.mock('@/lib/actions/like', () => ({
  toggleCommentLike: jest.fn().mockResolvedValue({ success: true, liked: true }),
}))

const mockComment = {
  id: 'comment-1',
  content: 'これはテストコメントです',
  createdAt: new Date().toISOString(),
  parentId: null,
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  likeCount: 5,
  replyCount: 0,
  isLiked: false,
}

describe('CommentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('コメント内容を表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('これはテストコメントです')).toBeInTheDocument()
  })

  it('ユーザー情報を表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('相対時間を表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    // formatDistanceToNowが「数秒前」や「約1分前」などを返す
    expect(screen.getByText(/前/)).toBeInTheDocument()
  })

  it('いいねボタンを表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('返信ボタンを表示する（ログイン時）', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByRole('button', { name: /返信/i })).toBeInTheDocument()
  })

  it('返信ボタンクリックで返信フォームを表示する', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    await user.click(screen.getByRole('button', { name: /返信/i }))
    expect(screen.getByPlaceholderText('@テストユーザー への返信...')).toBeInTheDocument()
  })

  it('コメント所有者のみ削除ボタンを表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1" // コメント投稿者と同じ
      />
    )
    // Trash2アイコンを持つボタンを探す
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteButton).toBeInTheDocument()
  })

  it('コメント所有者でない場合は削除ボタンを表示しない', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="other-user" // 別のユーザー
      />
    )
    const deleteButton = screen.queryAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteButton).toBeUndefined()
  })

  it('返信がある場合「返信を表示」ボタンを表示する', () => {
    const commentWithReplies = {
      ...mockComment,
      replyCount: 3,
    }
    render(
      <CommentCard
        comment={commentWithReplies}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByRole('button', { name: /3件の返信を表示/i })).toBeInTheDocument()
  })

  it('返信を表示ボタンクリックで返信を取得する', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'reply-1',
          content: '返信コメント',
          createdAt: new Date().toISOString(),
          parentId: 'comment-1',
          user: { id: 'user-2', nickname: '返信ユーザー', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })

    const commentWithReplies = {
      ...mockComment,
      replyCount: 1,
    }

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={commentWithReplies}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    await user.click(screen.getByRole('button', { name: /1件の返信を表示/i }))

    await waitFor(() => {
      expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
    })

    await waitFor(() => {
      expect(screen.getByText('返信コメント')).toBeInTheDocument()
    })
  })

  it('削除確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
      />
    )

    // 削除ボタンをクリック
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteButton!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      expect(screen.getByText('このコメントを削除してもよろしいですか？')).toBeInTheDocument()
    })
  })

  it('削除を実行する', async () => {
    mockDeleteComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
      />
    )

    // 削除ボタンをクリック
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteButton!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('ユーザーページへのリンクを持つ', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    const userLinks = screen.getAllByRole('link', { name: /テストユーザー/i })
    expect(userLinks[0]).toHaveAttribute('href', '/users/user-1')
  })

  it('返信コメントの場合はインデントされる', () => {
    const { container } = render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
        isReply
      />
    )
    expect(container.querySelector('.ml-8')).toBeInTheDocument()
  })

  it('削除エラー時にエラー状態になる', async () => {
    mockDeleteComment.mockResolvedValue({ error: '削除に失敗しました' })

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
      />
    )

    // 削除ボタンをクリック
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteButton!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
    })
  })

  it('削除キャンセルでダイアログが閉じる', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
      />
    )

    // 削除ボタンをクリック
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteButton!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText('コメントを削除')).not.toBeInTheDocument()
    })
  })

  it('返信フォームのキャンセルでフォームが閉じる', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    // 返信ボタンをクリック
    await user.click(screen.getByRole('button', { name: /返信/i }))

    expect(screen.getByPlaceholderText('@テストユーザー への返信...')).toBeInTheDocument()

    // キャンセルボタンをクリック
    await user.click(screen.getByRole('button', { name: /キャンセル/i }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('@テストユーザー への返信...')).not.toBeInTheDocument()
    })
  })

  it('currentUserIdがundefinedの場合は返信ボタンを表示しない', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId={undefined}
      />
    )
    expect(screen.queryByRole('button', { name: /返信/i })).not.toBeInTheDocument()
  })

})

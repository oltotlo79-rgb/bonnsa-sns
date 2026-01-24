import { render, screen } from '../../utils/test-utils'
import { QuotedPost } from '@/components/post/QuotedPost'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPost = {
  id: 'quoted-post-1',
  content: '引用元の投稿内容です。盆栽について語っています。',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  user: {
    id: 'user-1',
    nickname: '盆栽マスター',
    avatarUrl: '/avatar.jpg',
  },
}

describe('QuotedPost', () => {
  it('引用投稿を表示する', () => {
    render(<QuotedPost post={mockPost} />)
    expect(screen.getByText(mockPost.content)).toBeInTheDocument()
    expect(screen.getByText(mockPost.user.nickname)).toBeInTheDocument()
  })

  it('投稿へのリンクを持つ', () => {
    render(<QuotedPost post={mockPost} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/posts/${mockPost.id}`)
  })

  it('ユーザーアバターを表示する', () => {
    render(<QuotedPost post={mockPost} />)
    const avatar = screen.getByRole('img')
    expect(avatar).toHaveAttribute('alt', mockPost.user.nickname)
  })

  it('アバターがない場合はニックネームの頭文字を表示する', () => {
    const postWithoutAvatar = {
      ...mockPost,
      user: {
        ...mockPost.user,
        avatarUrl: null,
      },
    }
    render(<QuotedPost post={postWithoutAvatar} />)
    expect(screen.getByText('盆')).toBeInTheDocument()
  })

  it('相対時間を表示する', () => {
    // 現在の日時と投稿日時の差に基づいて相対時間が表示される
    render(<QuotedPost post={mockPost} />)
    // date-fnsのformatDistanceToNowの出力を確認
    // 例: "約1年前" など
    const timeElement = screen.getByText(/前|後/i)
    expect(timeElement).toBeInTheDocument()
  })

  it('contentがnullの場合は本文を表示しない', () => {
    const postWithoutContent = {
      ...mockPost,
      content: null,
    }
    render(<QuotedPost post={postWithoutContent} />)
    expect(screen.getByText(mockPost.user.nickname)).toBeInTheDocument()
    // 本文のpタグがないことを確認
    expect(screen.queryByText(/引用元の投稿内容/)).not.toBeInTheDocument()
  })

  it('長い本文は省略される（line-clamp-3）', () => {
    const longContent = 'これは非常に長い投稿内容です。'.repeat(10)
    const postWithLongContent = {
      ...mockPost,
      content: longContent,
    }
    render(<QuotedPost post={postWithLongContent} />)
    const contentElement = screen.getByText(longContent)
    expect(contentElement).toHaveClass('line-clamp-3')
  })

  it('Date型のcreatedAtを処理できる', () => {
    const postWithDateObject = {
      ...mockPost,
      createdAt: new Date('2024-01-15T10:00:00Z'),
    }
    render(<QuotedPost post={postWithDateObject} />)
    expect(screen.getByText(mockPost.content)).toBeInTheDocument()
  })

  it('文字列型のcreatedAtを処理できる', () => {
    const postWithDateString = {
      ...mockPost,
      createdAt: '2024-01-15T10:00:00Z',
    }
    render(<QuotedPost post={postWithDateString} />)
    expect(screen.getByText(mockPost.content)).toBeInTheDocument()
  })
})

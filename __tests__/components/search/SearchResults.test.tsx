import { render, screen } from '../../utils/test-utils'

// next/cache モック（先にモックを定義）
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  unstable_cache: jest.fn((fn) => fn),
}))

// PostCard コンポーネントをモック（依存関係の問題を回避）
jest.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid="post-card">{post.content}</div>
  ),
}))

// UserCard コンポーネントをモック
jest.mock('@/components/user/UserCard', () => ({
  UserCard: ({ user }: { user: { id: string; nickname: string } }) => (
    <div data-testid="user-card">{user.nickname}</div>
  ),
}))

import { PostSearchResults, UserSearchResults, TagSearchResults, PopularTags } from '@/components/search/SearchResults'

// Next-Auth モック
jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// React Query モック
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn().mockReturnValue({
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: jest.fn(),
}))

// intersection-observer モック
jest.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: jest.fn(), inView: false }),
}))

// Server Actions モック
jest.mock('@/lib/actions/search', () => ({
  searchPosts: jest.fn(),
  searchUsers: jest.fn(),
  searchByTag: jest.fn(),
}))

describe('PostSearchResults', () => {
  it('検索結果がない場合メッセージを表示する', () => {
    render(<PostSearchResults query="test" />)
    expect(screen.getByText('「test」に一致する投稿はありません')).toBeInTheDocument()
  })

  it('クエリがない場合の空メッセージを表示する', () => {
    render(<PostSearchResults query="" />)
    expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
  })
})

describe('UserSearchResults', () => {
  it('検索結果がない場合メッセージを表示する', () => {
    render(<UserSearchResults query="test" />)
    expect(screen.getByText('「test」に一致するユーザーはいません')).toBeInTheDocument()
  })

  it('クエリがない場合の空メッセージを表示する', () => {
    render(<UserSearchResults query="" />)
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
  })
})

describe('TagSearchResults', () => {
  it('タグ検索結果がない場合メッセージを表示する', () => {
    render(<TagSearchResults tag="bonsai" />)
    expect(screen.getByText('#bonsai を含む投稿はありません')).toBeInTheDocument()
  })

  it('タグがない場合の空メッセージを表示する', () => {
    render(<TagSearchResults tag="" />)
    expect(screen.getByText('タグを入力してください')).toBeInTheDocument()
  })
})

describe('PopularTags', () => {
  it('人気タグを表示する', () => {
    const tags = [
      { tag: '松柏', count: 10 },
      { tag: '雑木', count: 5 },
    ]
    render(<PopularTags tags={tags} />)

    expect(screen.getByText('人気のタグ')).toBeInTheDocument()
    expect(screen.getByText('#松柏')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('#雑木')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('タグがない場合何も表示しない', () => {
    const { container } = render(<PopularTags tags={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('タグリンクが正しいhrefを持つ', () => {
    const tags = [{ tag: '松柏', count: 10 }]
    render(<PopularTags tags={tags} />)

    const link = screen.getByRole('link', { name: /#松柏/i })
    expect(link).toHaveAttribute('href', '/search?tab=tags&q=%E6%9D%BE%E6%9F%8F')
  })
})

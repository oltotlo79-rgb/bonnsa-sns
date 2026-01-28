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

// React Query モック - デフォルトは空の結果
const mockUseInfiniteQuery = jest.fn().mockReturnValue({
  data: undefined,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
})

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
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
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
  })

  it('検索結果がない場合メッセージを表示する', () => {
    render(<PostSearchResults query="test" />)
    expect(screen.getByText('「test」に一致する投稿はありません')).toBeInTheDocument()
  })

  it('クエリがない場合の空メッセージを表示する', () => {
    render(<PostSearchResults query="" />)
    expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示する', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    })
    const { container } = render(<PostSearchResults query="test" />)
    // ローディング中はスケルトンが表示される
    const skeletonElements = container.querySelectorAll('.animate-pulse')
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it('検索結果がある場合投稿カードを表示する', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: 'テスト投稿1', user: { id: 'user-1', nickname: 'User1' } },
            { id: 'post-2', content: 'テスト投稿2', user: { id: 'user-2', nickname: 'User2' } },
          ],
          nextCursor: undefined,
        }],
        pageParams: [undefined],
      },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
    render(<PostSearchResults query="test" currentUserId="test-user-id" />)
    expect(screen.getByText('テスト投稿1')).toBeInTheDocument()
    expect(screen.getByText('テスト投稿2')).toBeInTheDocument()
  })
})

describe('UserSearchResults', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
  })

  it('検索結果がない場合メッセージを表示する', () => {
    render(<UserSearchResults query="test" />)
    expect(screen.getByText('「test」に一致するユーザーはいません')).toBeInTheDocument()
  })

  it('クエリがない場合の空メッセージを表示する', () => {
    render(<UserSearchResults query="" />)
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示する', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    })
    const { container } = render(<UserSearchResults query="test" />)
    const skeletonElements = container.querySelectorAll('.animate-pulse')
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it('検索結果がある場合ユーザーカードを表示する', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          users: [
            { id: 'user-1', nickname: 'テストユーザー1', avatarUrl: null },
            { id: 'user-2', nickname: 'テストユーザー2', avatarUrl: null },
          ],
          nextCursor: undefined,
        }],
        pageParams: [undefined],
      },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
    render(<UserSearchResults query="test" />)
    expect(screen.getByText('テストユーザー1')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー2')).toBeInTheDocument()
  })
})

describe('TagSearchResults', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
  })

  it('タグ検索結果がない場合メッセージを表示する', () => {
    render(<TagSearchResults tag="bonsai" />)
    expect(screen.getByText('#bonsai を含む投稿はありません')).toBeInTheDocument()
  })

  it('タグがない場合の空メッセージを表示する', () => {
    render(<TagSearchResults tag="" />)
    expect(screen.getByText('タグを入力してください')).toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示する', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    })
    const { container } = render(<TagSearchResults tag="bonsai" />)
    const skeletonElements = container.querySelectorAll('.animate-pulse')
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it('タグ検索結果がある場合投稿カードを表示する', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: '#bonsai テスト投稿', user: { id: 'user-1', nickname: 'User1' } },
          ],
          nextCursor: undefined,
        }],
        pageParams: [undefined],
      },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
    render(<TagSearchResults tag="bonsai" currentUserId="test-user-id" />)
    expect(screen.getByText('#bonsai テスト投稿')).toBeInTheDocument()
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

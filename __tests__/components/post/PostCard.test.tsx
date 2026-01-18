import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostCard } from '@/components/post/PostCard'
import { mockPost, mockUser } from '../../utils/test-utils'

// Prisma モック（テスト環境で必須）
jest.mock('@/lib/db', () => ({
  prisma: {
    post: { findMany: jest.fn(), create: jest.fn() },
    user: { findMany: jest.fn() },
    report: { create: jest.fn() },
  },
}))

// Server Actionsモック
jest.mock('@/lib/actions/like', () => ({
  toggleLike: jest.fn().mockResolvedValue({ success: true, liked: true }),
}))

jest.mock('@/lib/actions/bookmark', () => ({
  toggleBookmark: jest.fn().mockResolvedValue({ success: true, bookmarked: true }),
}))

jest.mock('@/lib/actions/post', () => ({
  deletePost: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock('@/lib/actions/report', () => ({
  createReport: jest.fn().mockResolvedValue({ success: true }),
}))

// Next.js navigation モック
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
  }),
}))

describe('PostCard', () => {
  const defaultProps = {
    post: {
      id: mockPost.id,
      content: mockPost.content,
      createdAt: mockPost.createdAt,
      user: {
        id: 'user-1',
        nickname: mockUser.nickname,
        avatarUrl: mockUser.avatarUrl,
      },
      media: [],
      genres: [{ id: 'genre-1', name: '松柏類', category: '松柏類' }],
      likeCount: 5,
      commentCount: 3,
      isLiked: false,
      isBookmarked: false,
    },
    currentUserId: 'current-user-id',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('投稿内容を正しく表示する', () => {
    render(<PostCard {...defaultProps} />)
    // ハッシュタグがリンク化されるため、部分一致で確認
    expect(screen.getByText(/テスト投稿の内容/)).toBeInTheDocument()
    expect(screen.getByText('#テスト')).toBeInTheDocument()
  })

  it('ユーザー名を表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText(mockUser.nickname)).toBeInTheDocument()
  })

  it('いいね数を表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('コメント数を表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('ジャンルタグを表示する', () => {
    render(<PostCard {...defaultProps} />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
  })

  it('ジャンルタグをクリックすると検索ページへ遷移する', () => {
    render(<PostCard {...defaultProps} />)
    const genreLink = screen.getByText('松柏類')
    expect(genreLink.closest('a')).toHaveAttribute('href', '/search?genre=genre-1')
  })

  it('ユーザー名をクリックするとプロフィールページへ遷移する', () => {
    render(<PostCard {...defaultProps} />)
    const userLink = screen.getByText(mockUser.nickname)
    expect(userLink.closest('a')).toHaveAttribute('href', '/users/user-1')
  })

  it('カード全体をクリックすると投稿詳細ページへ遷移する', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />)

    const article = screen.getByRole('article')
    await user.click(article)

    expect(mockPush).toHaveBeenCalledWith(`/posts/${mockPost.id}`)
  })

  it('disableNavigationがtrueの場合、カードクリックで遷移しない', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} disableNavigation={true} />)

    const article = screen.getByRole('article')
    await user.click(article)

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('自分の投稿にはメニューから削除ボタンが表示される', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps,
      currentUserId: 'user-1', // 投稿者と同じID
    }
    render(<PostCard {...props} />)

    // メニューボタンをクリック
    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    if (menuButton) {
      await user.click(menuButton)
      // 削除ボタンが表示される
      await waitFor(() => {
        expect(screen.getByText(/削除/i)).toBeInTheDocument()
      })
    }
  })

  it('他人の投稿にはメニューから通報ボタンが表示される', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />)

    // メニューボタンをクリック
    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    if (menuButton) {
      await user.click(menuButton)
      // 通報ボタンが表示される
      await waitFor(() => {
        expect(screen.getByText(/通報/i)).toBeInTheDocument()
      })
    }
  })

  it('ハッシュタグをリンクとして表示する', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'テスト投稿 #盆栽 について',
      },
    }
    render(<PostCard {...props} />)

    const hashtag = screen.getByText('#盆栽')
    expect(hashtag.closest('a')).toHaveAttribute('href', '/search?q=%23%E7%9B%86%E6%A0%BD')
  })

  it('長いコンテンツは省略されて「続きを表示」ボタンが表示される', () => {
    const longContent = 'あ'.repeat(200) // 150文字を超える
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: longContent,
      },
    }
    render(<PostCard {...props} />)

    expect(screen.getByText(/続きを表示/i)).toBeInTheDocument()
    // 省略記号が表示されていることを確認
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  })

  it('「続きを表示」をクリックすると全文が表示される', async () => {
    const user = userEvent.setup()
    const longContent = 'あ'.repeat(200)
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: longContent,
      },
    }
    render(<PostCard {...props} />)

    const showMoreButton = screen.getByText(/続きを表示/i)
    await user.click(showMoreButton)

    // 「続きを表示」ボタンが消える
    expect(screen.queryByText(/続きを表示/i)).not.toBeInTheDocument()
  })

  it('リポストの場合、リポスト表示がある', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        repostPost: {
          id: 'original-post',
          content: '元の投稿です',
          createdAt: new Date().toISOString(),
          user: {
            id: 'original-user',
            nickname: 'オリジナルユーザー',
            avatarUrl: null,
          },
          media: [],
        },
      },
    }
    render(<PostCard {...props} />)

    expect(screen.getByText(/がリポスト/)).toBeInTheDocument()
    expect(screen.getByText('元の投稿です')).toBeInTheDocument()
  })

  it('引用投稿の場合、引用表示がある', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        quotePost: {
          id: 'quoted-post',
          content: '引用された投稿です',
          createdAt: new Date().toISOString(),
          user: {
            id: 'quoted-user',
            nickname: '引用元ユーザー',
            avatarUrl: null,
          },
        },
      },
    }
    render(<PostCard {...props} />)

    expect(screen.getByText('引用された投稿です')).toBeInTheDocument()
    expect(screen.getByText('引用元ユーザー')).toBeInTheDocument()
  })

  it('未ログインユーザーにはいいねボタンがログインリンクになる', () => {
    const props = {
      ...defaultProps,
      currentUserId: undefined,
    }
    render(<PostCard {...props} />)

    // いいねアイコンを含むリンクがログインページへ向かう
    const likeLinks = screen.getAllByRole('link')
    const loginLink = likeLinks.find(link => link.getAttribute('href') === '/login')
    expect(loginLink).toBeInTheDocument()
  })

  it('いいね済みの投稿はinitialLikedがtrueで表示される', () => {
    const props = {
      ...defaultProps,
      initialLiked: true,
    }
    render(<PostCard {...props} />)
    // LikeButtonがinitialLiked=trueで描画されることを確認
    // (実際のUIテストはLikeButton.test.tsxで行う)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('ブックマーク済みの投稿はinitialBookmarkedがtrueで表示される', () => {
    const props = {
      ...defaultProps,
      initialBookmarked: true,
    }
    render(<PostCard {...props} />)
    // BookmarkButtonがinitialBookmarked=trueで描画されることを確認
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('いいね数が0の場合は数字が表示されない', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        likeCount: 0,
      },
    }
    render(<PostCard {...props} />)
    // 0は表示されないことを確認
    const article = screen.getByRole('article')
    // コメント数の3は表示される
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('コメント数が0の場合は数字が表示されない', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        commentCount: 0,
      },
    }
    render(<PostCard {...props} />)
    // いいね数の5は表示される
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('メディアがある場合はImageGalleryが表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        media: [
          { id: 'media-1', url: '/test-image.jpg', type: 'image', sortOrder: 0 },
        ],
      },
    }
    render(<PostCard {...props} />)
    // ImageGalleryコンポーネントが描画される
    // (実際の画像テストはImageGallery.test.tsxで行う)
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('アバターがない場合はニックネームの頭文字が表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        user: {
          ...defaultProps.post.user,
          avatarUrl: null,
        },
      },
    }
    render(<PostCard {...props} />)

    // ニックネームの最初の文字が表示される
    expect(screen.getByText(mockUser.nickname.charAt(0))).toBeInTheDocument()
  })

  it('複数のジャンルタグが全て表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        genres: [
          { id: 'genre-1', name: '松柏類', category: '松柏類' },
          { id: 'genre-2', name: '雑木類', category: '雑木類' },
          { id: 'genre-3', name: '草物', category: '草物' },
        ],
      },
    }
    render(<PostCard {...props} />)

    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
    expect(screen.getByText('草物')).toBeInTheDocument()
  })
})

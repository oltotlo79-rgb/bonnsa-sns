/**
 * ============================================================================
 * いいね機能のServer Actionsテスト
 * ============================================================================
 *
 * このファイルは、投稿やコメントへの「いいね」機能をテストします。
 *
 * ## いいね機能とは？
 * SNSでおなじみの機能で、投稿やコメントに対して
 * 「良いね」という意思表示をする機能です。
 *
 * ## テストの対象
 * - togglePostLike: 投稿へのいいねのON/OFF切り替え
 * - toggleCommentLike: コメントへのいいねのON/OFF切り替え
 * - getPostLikeStatus: 投稿のいいね状態を取得
 * - getLikedPosts: ユーザーがいいねした投稿一覧を取得
 *
 * ## いいね機能の仕組み
 * 1. ユーザーがいいねボタンをクリック
 * 2. まだいいねしていなければ、いいねを追加（Likeレコード作成）
 * 3. 既にいいねしていれば、いいねを削除（Likeレコード削除）
 * 4. 他人の投稿にいいねした場合、通知を送信
 *
 * ## トグル（Toggle）パターン
 * ON/OFFを切り替える操作パターン。
 * 1回クリック→ON、もう1回クリック→OFF
 * いいね、フォロー、ブックマークなどでよく使われる。
 *
 * @jest-environment node
 */

// ============================================================================
// インポートとモックのセットアップ
// ============================================================================

/**
 * テストユーティリティとモックデータのインポート
 *
 * - createMockPrismaClient: Prismaクライアントのモック
 * - mockUser: テスト用のユーザーデータ
 * - mockPost: テスト用の投稿データ
 * - mockComment: テスト用のコメントデータ
 */
import { createMockPrismaClient, mockUser, mockPost, mockComment } from '../../utils/test-utils'

/**
 * Prismaクライアントのモック
 * ----------------------------------------------------------------------------
 * データベース操作を模擬。実際のDBに接続せずにテストできる。
 */
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

/**
 * 認証機能のモック
 * ----------------------------------------------------------------------------
 * auth()関数をモック化し、任意の認証状態をシミュレート。
 * 認証済み/未認証の両方のケースをテストできる。
 */
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

/**
 * キャッシュ再検証のモック
 * ----------------------------------------------------------------------------
 * revalidatePath: 指定したパスのキャッシュを無効化する関数。
 * いいね後にUIを更新するために使用される。
 *
 * Next.jsのキャッシュとは：
 * サーバーコンポーネントの出力をキャッシュして高速化する仕組み。
 * データ変更後は再検証（キャッシュ更新）が必要。
 */
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

/**
 * レート制限のモック
 * ----------------------------------------------------------------------------
 * レート制限: 短時間に大量のリクエストを防ぐ仕組み。
 * スパム対策やサーバー負荷軽減のために使用。
 *
 * 例：1分間に100回までいいね可能、それ以上はブロック
 */
const mockCheckUserRateLimit = jest.fn().mockResolvedValue({ success: true })
jest.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

/**
 * 分析機能のモック
 * ----------------------------------------------------------------------------
 * いいねの受信を記録する分析機能。
 * プレミアム会員向けの詳細な分析に使用される。
 */
jest.mock('@/lib/actions/analytics', () => ({
  recordLikeReceived: jest.fn().mockResolvedValue(undefined),
}))

// ============================================================================
// テストスイート
// ============================================================================
describe('Like Actions', () => {
  /**
   * 各テスト前の準備
   *
   * - モックの呼び出し履歴をクリア
   * - デフォルトで認証済み状態を設定
   */
  beforeEach(() => {
    jest.clearAllMocks()
    // デフォルトで認証済みユーザーとして設定
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  // ============================================================
  // togglePostLike（投稿へのいいね切り替え）
  // ============================================================
  /**
   * togglePostLike関数のテスト
   *
   * この関数は、投稿へのいいねをON/OFF切り替えます。
   *
   * 処理の流れ：
   * 1. 認証チェック
   * 2. レート制限チェック
   * 3. 既存のいいねを検索
   * 4. いいねがあれば削除、なければ作成
   * 5. 他人の投稿なら通知を作成
   * 6. キャッシュを再検証
   */
  describe('togglePostLike (投稿)', () => {
    /**
     * テストケース1: 未認証の場合
     *
     * いいね機能は認証が必要。
     * 未認証ユーザーにはエラーを返す。
     */
    it('認証なしの場合はエラーを返す', async () => {
      // 未認証状態を設定
      mockAuth.mockResolvedValue(null)

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    /**
     * テストケース2: いいねを追加
     *
     * シナリオ：
     * - ユーザーがまだいいねしていない投稿
     * - いいねを追加する
     *
     * 期待結果：
     * - success: true
     * - liked: true（いいね済みになった）
     * - Likeレコードが作成される
     */
    it('いいねしていない場合は追加する', async () => {
      // 既存のいいねがない
      mockPrisma.like.findFirst.mockResolvedValue(null)
      // いいね作成が成功
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: mockPost.id,
        commentId: null,  // 投稿へのいいねなのでコメントIDはnull
      })
      // 投稿情報を返す（通知判定用）
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,  // 自分の投稿
      })

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      // 結果を検証
      expect(result).toEqual({ success: true, liked: true })
      // いいねが作成されたことを確認
      expect(mockPrisma.like.create).toHaveBeenCalled()
    })

    /**
     * テストケース3: いいねを削除
     *
     * シナリオ：
     * - ユーザーが既にいいねしている投稿
     * - いいねを解除する
     *
     * 期待結果：
     * - success: true
     * - liked: false（いいね解除になった）
     * - Likeレコードが削除される
     */
    it('いいね済みの場合は削除する', async () => {
      // 既存のいいねがある
      mockPrisma.like.findFirst.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: mockPost.id,
        commentId: null,
      })
      // 削除が成功
      mockPrisma.like.delete.mockResolvedValue({})

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ success: true, liked: false })
      expect(mockPrisma.like.delete).toHaveBeenCalled()
    })

    /**
     * テストケース4: 他人の投稿へのいいねで通知が送られる
     *
     * シナリオ：
     * - 他人の投稿にいいねする
     * - 投稿者に通知が送られる
     *
     * 通知の仕組み：
     * - userId: 通知を受け取る人（投稿者）
     * - actorId: アクションを起こした人（いいねした人）
     * - type: 通知の種類（'like'）
     */
    it('他人の投稿にいいねすると通知が作成される', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: mockPost.id,
        commentId: null,
      })
      // 他人の投稿
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',  // 投稿者は別のユーザー
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { togglePostLike } = await import('@/lib/actions/like')
      await togglePostLike('post-id')

      // 通知が作成されたことを確認
      // expect.objectContaining: オブジェクトの一部だけを検証
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'other-user-id', // 投稿者に通知
            actorId: mockUser.id,    // いいねした人
            type: 'like',            // 通知タイプ
          }),
        })
      )
    })

    /**
     * テストケース5: 自分の投稿へのいいねでは通知が送られない
     *
     * 自分で自分に通知を送る必要はないので、
     * 自分の投稿へのいいねでは通知を作成しない。
     */
    it('自分の投稿にいいねしても通知は作成されない', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({})
      // 自分の投稿
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,  // 投稿者は自分
      })

      const { togglePostLike } = await import('@/lib/actions/like')
      await togglePostLike('post-id')

      // 通知が作成されていないことを確認
      // not.toHaveBeenCalled(): 呼ばれていないことを確認
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('toggleCommentLike (コメント)', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('コメントにいいねを追加できる', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: null,
        commentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
      })

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ success: true, liked: true })
    })

    it('コメントのいいねを削除できる', async () => {
      mockPrisma.like.findFirst.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        commentId: mockComment.id,
      })
      mockPrisma.like.delete.mockResolvedValue({})

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ success: true, liked: false })
    })

    it('他人のコメントにいいねすると通知が作成される', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: null,
        commentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { toggleCommentLike } = await import('@/lib/actions/like')
      await toggleCommentLike('comment-id', 'post-id')

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'other-user-id',
            actorId: mockUser.id,
            type: 'comment_like',
          }),
        })
      )
    })
  })

  describe('getPostLikeStatus', () => {
    it('いいね状態を取得できる（いいね済み）', async () => {
      mockPrisma.like.findFirst.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: 'post-id',
      })

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(true)
    })

    it('いいね状態を取得できる（未いいね）', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(false)
    })

    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(false)
    })

    it('エラー発生時はfalseを返す', async () => {
      mockPrisma.like.findFirst.mockRejectedValue(new Error('Database error'))

      const { getPostLikeStatus } = await import('@/lib/actions/like')
      const result = await getPostLikeStatus('post-id')

      expect(result.liked).toBe(false)
    })
  })

  describe('togglePostLike - 追加テスト', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockRejectedValue(new Error('Database error'))

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ error: 'いいねの処理に失敗しました' })
    })

    it('投稿が見つからない場合でも処理は成功する', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({})
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { togglePostLike } = await import('@/lib/actions/like')
      const result = await togglePostLike('post-id')

      expect(result).toEqual({ success: true, liked: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('toggleCommentLike - 追加テスト', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('自分のコメントにいいねしても通知は作成されない', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({
        id: 'like-1',
        userId: mockUser.id,
        postId: null,
        commentId: mockComment.id,
      })
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
      })

      const { toggleCommentLike } = await import('@/lib/actions/like')
      await toggleCommentLike('comment-id', 'post-id')

      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('コメントが見つからない場合でも処理は成功する', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({})
      mockPrisma.comment.findUnique.mockResolvedValue(null)

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ success: true, liked: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockPrisma.like.findFirst.mockRejectedValue(new Error('Database error'))

      const { toggleCommentLike } = await import('@/lib/actions/like')
      const result = await toggleCommentLike('comment-id', 'post-id')

      expect(result).toEqual({ error: 'いいねの処理に失敗しました' })
    })
  })

  describe('getLikedPosts', () => {
    it('ユーザーがいいねした投稿一覧を取得できる', async () => {
      const likeData = {
        id: 'like-1',
        userId: mockUser.id,
        postId: 'post-1',
        commentId: null,
        createdAt: new Date(),
        post: {
          ...mockPost,
          id: 'post-1',
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 5, comments: 3 },
        },
      }
      // 最初の呼び出し（いいね一覧取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([likeData])
      // 2回目の呼び出し（現在のユーザーのいいね状態取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.posts).toHaveLength(1)
      expect(mockPrisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            postId: { not: null },
            commentId: null,
          },
        })
      )
    })

    it('未認証でもいいねした投稿を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.like.findMany.mockResolvedValue([
        {
          id: 'like-1',
          postId: 'post-1',
          post: {
            ...mockPost,
            id: 'post-1',
            user: mockUser,
            media: [],
            genres: [],
            _count: { likes: 5, comments: 3 },
          },
        },
      ])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts('other-user-id')

      expect(result.posts).toHaveLength(1)
      // 未認証なのでisLiked/isBookmarkedはfalse
      expect(result.posts[0].isLiked).toBe(false)
      expect(result.posts[0].isBookmarked).toBe(false)
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      await getLikedPosts(mockUser.id, 'cursor-id', 10)

      expect(mockPrisma.like.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('削除された投稿は除外される', async () => {
      // 最初の呼び出し（いいね一覧取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([
        {
          id: 'like-1',
          postId: 'deleted-post-id',
          createdAt: new Date(),
          post: null, // 削除された投稿
        },
        {
          id: 'like-2',
          postId: 'post-1',
          createdAt: new Date(),
          post: {
            ...mockPost,
            id: 'post-1',
            user: mockUser,
            media: [],
            genres: [],
            _count: { likes: 5, comments: 3 },
          },
        },
      ])
      // 2回目の呼び出し（現在のユーザーのいいね状態取得）
      mockPrisma.like.findMany.mockResolvedValueOnce([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].id).toBe('post-1')
    })

    it('いいね/ブックマーク状態が正しく設定される', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.like.findMany
        .mockResolvedValueOnce([
          {
            id: 'like-1',
            postId: 'post-1',
            post: {
              ...mockPost,
              id: 'post-1',
              user: mockUser,
              media: [],
              genres: [],
              _count: { likes: 5, comments: 3 },
            },
          },
        ])
        .mockResolvedValueOnce([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-1' }])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts('other-user-id')

      expect(result.posts[0].isLiked).toBe(true)
      expect(result.posts[0].isBookmarked).toBe(true)
    })

    it('エラー発生時は空の配列を返す', async () => {
      mockPrisma.like.findMany.mockRejectedValue(new Error('Database error'))

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.posts).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('limit件取得した場合は次のカーソルを返す', async () => {
      const likes = Array(20).fill(null).map((_, i) => ({
        id: `like-${i}`,
        postId: `post-${i}`,
        createdAt: new Date(),
        post: {
          ...mockPost,
          id: `post-${i}`,
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 0, comments: 0 },
        },
      }))
      // 最初の呼び出し（いいね一覧取得）
      mockPrisma.like.findMany.mockResolvedValueOnce(likes)
      // 2回目の呼び出し（現在のユーザーのいいね状態取得）
      const postIds = Array(20).fill(null).map((_, i) => ({ postId: `post-${i}` }))
      mockPrisma.like.findMany.mockResolvedValueOnce(postIds)
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getLikedPosts } = await import('@/lib/actions/like')
      const result = await getLikedPosts(mockUser.id)

      expect(result.nextCursor).toBe('like-19')
    })
  })
})

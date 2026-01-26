/**
 * ============================================================================
 * フォロー機能のServer Actionsテスト
 * ============================================================================
 *
 * このファイルは、ユーザー間のフォロー機能をテストします。
 *
 * ## フォロー機能とは？
 * SNSで他のユーザーをフォローすると、そのユーザーの投稿が
 * 自分のタイムラインに表示されるようになります。
 *
 * ## 用語の説明
 * - フォロワー（Follower）: 自分をフォローしている人
 * - フォロー中（Following）: 自分がフォローしている人
 * - 相互フォロー: お互いにフォローし合っている状態
 *
 * ## テストの対象
 * - toggleFollow: フォローのON/OFF切り替え
 * - getFollowers: フォロワー一覧の取得
 * - getFollowing: フォロー中一覧の取得
 * - getFollowStatus: フォロー状態の確認
 *
 * ## データ構造
 * Followテーブル:
 * - followerId: フォローする側のユーザーID
 * - followingId: フォローされる側のユーザーID
 *
 * 例：AさんがBさんをフォローする場合
 * - followerId: Aさん（フォローする人）
 * - followingId: Bさん（フォローされる人）
 *
 * @jest-environment node
 */

// ============================================================================
// インポートとモックのセットアップ
// ============================================================================

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

/**
 * Prismaクライアントのモック
 */
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

/**
 * 認証機能のモック
 */
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

/**
 * キャッシュ再検証のモック
 *
 * フォロー状態が変わった時、UIを更新するために
 * キャッシュを再検証する必要がある。
 */
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// ============================================================================
// テストスイート
// ============================================================================
describe('Follow Actions', () => {
  /**
   * 各テスト前の準備
   */
  beforeEach(() => {
    jest.clearAllMocks()
    // デフォルトで認証済み状態を設定
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  // ============================================================
  // toggleFollow（フォロー切り替え）
  // ============================================================
  /**
   * toggleFollow関数のテスト
   *
   * この関数は、指定したユーザーへのフォローをON/OFF切り替えます。
   *
   * 処理の流れ：
   * 1. 認証チェック
   * 2. 自分自身へのフォローを禁止
   * 3. 対象ユーザーの存在確認
   * 4. 公開/非公開アカウントの確認
   * 5. 既存のフォロー関係を確認
   * 6. フォローがあれば削除、なければ作成
   * 7. フォロー時は通知を送信
   */
  describe('toggleFollow', () => {
    /**
     * テストケース1: 未認証の場合
     *
     * フォロー機能は認証が必要。
     */
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    /**
     * テストケース2: 自分自身へのフォローを禁止
     *
     * 自分で自分をフォローすることは意味がないので禁止。
     * 悪意のある操作や誤操作を防ぐ。
     */
    it('自分自身はフォローできない', async () => {
      const { toggleFollow } = await import('@/lib/actions/follow')
      // 自分のIDを渡す
      const result = await toggleFollow(mockUser.id)

      expect(result).toEqual({ error: '自分自身をフォローすることはできません' })
    })

    /**
     * テストケース3: 公開アカウントへのフォロー
     *
     * シナリオ：
     * - フォローしていないユーザー
     * - 対象は公開アカウント
     * - フォローを追加する
     *
     * 期待結果：
     * - success: true
     * - following: true
     * - Followレコードが作成される
     * - 相手に通知が送られる
     */
    it('フォローしていない場合は追加する', async () => {
      // まだフォローしていない
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 公開アカウントのユーザー
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true })
      // フォロー作成成功
      mockPrisma.follow.create.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      // 通知作成成功
      mockPrisma.notification.create.mockResolvedValue({})

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: true, following: true })
      // フォローが作成されたことを確認
      expect(mockPrisma.follow.create).toHaveBeenCalled()
      // 通知が作成されたことを確認
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    /**
     * テストケース4: 非公開アカウントへのフォロー
     *
     * 非公開アカウント（鍵アカウント）の場合、
     * 直接フォローはできず、フォローリクエストが必要。
     *
     * プライバシー保護のための仕組み。
     */
    it('非公開アカウントへのフォローはエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 非公開アカウント（isPublic: false）
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: false })

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({
        error: 'このユーザーは非公開アカウントです。フォローリクエストを送信してください',
        requiresRequest: true, // フロントエンドでフォローリクエストUIを表示するためのフラグ
      })
      // フォローは作成されない
      expect(mockPrisma.follow.create).not.toHaveBeenCalled()
    })

    /**
     * テストケース5: 存在しないユーザーへのフォロー
     *
     * 無効なユーザーIDが渡された場合のエラーハンドリング。
     */
    it('存在しないユーザーへのフォローはエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // ユーザーが見つからない
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('non-existent-user')

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })

    /**
     * テストケース6: フォロー解除
     *
     * シナリオ：
     * - 既にフォローしているユーザー
     * - フォローを解除する
     *
     * 期待結果：
     * - success: true
     * - following: false
     * - Followレコードが削除される
     */
    it('フォロー済みの場合は解除する', async () => {
      // 既にフォローしている
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      mockPrisma.follow.delete.mockResolvedValue({})

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: true, following: false })
      expect(mockPrisma.follow.delete).toHaveBeenCalled()
    })
  })

  // ============================================================
  // getFollowers（フォロワー一覧取得）
  // ============================================================
  /**
   * getFollowers関数のテスト
   *
   * この関数は、指定したユーザーのフォロワー一覧を取得します。
   * プロフィールページの「フォロワー」タブで使用。
   */
  describe('getFollowers', () => {
    /**
     * テストケース: フォロワー一覧の取得
     *
     * follow.findManyでFollowレコードを取得し、
     * followerリレーションからユーザー情報を取得。
     */
    it('フォロワー一覧を取得できる', async () => {
      const mockFollowers = [
        {
          // フォロワーのユーザー情報
          follower: {
            id: 'follower-1',
            nickname: 'Follower 1',
            avatarUrl: '/avatar1.jpg',
            bio: 'Bio 1',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers)

      const { getFollowers } = await import('@/lib/actions/follow')
      const result = await getFollowers('target-user-id')

      // フォロワーが1人いることを確認
      expect(result.users).toHaveLength(1)
      expect(result.users[0].id).toBe('follower-1')
    })
  })

  // ============================================================
  // getFollowing（フォロー中一覧取得）
  // ============================================================
  /**
   * getFollowing関数のテスト
   *
   * この関数は、指定したユーザーがフォローしている人の一覧を取得します。
   * プロフィールページの「フォロー中」タブで使用。
   */
  describe('getFollowing', () => {
    /**
     * テストケース: フォロー中一覧の取得
     */
    it('フォロー中一覧を取得できる', async () => {
      const mockFollowing = [
        {
          // フォローしている人のユーザー情報
          following: {
            id: 'following-1',
            nickname: 'Following 1',
            avatarUrl: '/avatar1.jpg',
            bio: 'Bio 1',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowing)

      const { getFollowing } = await import('@/lib/actions/follow')
      const result = await getFollowing('target-user-id')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].id).toBe('following-1')
    })
  })

  // ============================================================
  // getFollowStatus（フォロー状態確認）
  // ============================================================
  /**
   * getFollowStatus関数のテスト
   *
   * この関数は、ログインユーザーが指定したユーザーを
   * フォローしているかどうかを確認します。
   *
   * フォローボタンの表示切り替えに使用。
   * - フォローしている → 「フォロー解除」ボタン
   * - フォローしていない → 「フォロー」ボタン
   */
  describe('getFollowStatus', () => {
    /**
     * テストケース1: フォロー中の場合
     */
    it('フォロー状態を取得できる', async () => {
      // フォローレコードが存在する
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(true)
    })

    /**
     * テストケース2: フォローしていない場合
     */
    it('フォローしていない場合はfalseを返す', async () => {
      // フォローレコードが存在しない
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(false)
    })

    /**
     * テストケース3: 未認証の場合
     *
     * ログインしていない場合は、フォロー状態を確認できないので
     * デフォルトでfalseを返す。
     */
    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(false)
    })
  })
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * npm test -- __tests__/lib/actions/follow.test.ts
 *
 * ## フォロー機能の実装ポイント
 *
 * 1. 複合主キー
 *    Followテーブルは (followerId, followingId) の複合主キー。
 *    これにより、同じ関係の重複を防ぐ。
 *
 * 2. 自己参照リレーション
 *    UserテーブルとFollowテーブルの関係は「自己参照」。
 *    同じUserテーブルに対して2つのリレーション（follower, following）がある。
 *
 * 3. 非公開アカウントの考慮
 *    SNSでは、非公開アカウント（鍵アカウント）の場合、
 *    フォローリクエストの承認が必要。
 *    このシステムでは別途FollowRequestテーブルで管理。
 */

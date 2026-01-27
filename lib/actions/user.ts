/**
 * ユーザー関連のServer Actions
 *
 * このファイルは、ユーザー情報の取得・更新に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - ユーザー情報の取得
 * - プロフィール更新
 * - プライバシー設定の更新
 * - アバター画像のアップロード
 * - ヘッダー画像のアップロード
 * - アカウント削除
 * - フォロワー/フォロー中一覧の取得
 *
 * ## ユーザー情報に含まれるデータ
 * - 基本情報: ニックネーム、自己紹介、居住地域
 * - 盆栽歴: 開始年月
 * - 画像: アバター、ヘッダー
 * - 統計: 投稿数、フォロワー数、フォロー中数
 * - 設定: 公開/非公開アカウント
 *
 * @module lib/actions/user
 */

'use server'

// ============================================================
// インポート
// ============================================================

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証関数
 * NextAuth.jsのセッション取得に使用
 */
import { auth } from '@/lib/auth'

/**
 * Next.jsのキャッシュ再検証関数
 * プロフィール更新後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * Zodバリデーションライブラリ
 * 入力値の検証に使用
 */
import { z } from 'zod'

/**
 * ファイルアップロード関数
 * ストレージへの画像アップロードに使用
 */
import { uploadFile } from '@/lib/storage'

/**
 * ファイル検証関数
 * シグネチャ検証でMIMEタイプ偽装を防止
 */
import { validateImageFile, generateSafeFileName } from '@/lib/file-validation'

// ============================================================
// バリデーションスキーマ
// ============================================================

/**
 * プロフィール更新のバリデーションスキーマ
 *
 * ## フィールド
 * - nickname: 必須、1〜50文字
 * - bio: 任意、200文字以内
 * - location: 任意、100文字以内
 * - bonsaiStartYear: 任意、1900〜現在年
 * - bonsaiStartMonth: 任意、1〜12
 *
 * ## Zodとは
 * TypeScriptファーストのスキーマ検証ライブラリ
 * 入力値の型安全な検証ができる
 */
const profileSchema = z.object({
  nickname: z.string().min(1, 'ニックネームは必須です').max(50, 'ニックネームは50文字以内で入力してください'),
  bio: z.string().max(200, '自己紹介は200文字以内で入力してください').optional(),
  location: z.string().max(100, '居住地域は100文字以内で入力してください').optional(),
  bonsaiStartYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  bonsaiStartMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthDate: z.string().nullable().optional(),
})

// ============================================================
// ユーザー情報取得
// ============================================================

/**
 * ユーザー情報を取得
 *
 * ## 機能概要
 * 指定されたユーザーIDのユーザー情報を取得します。
 * プロフィールページの表示に使用されます。
 *
 * ## 取得内容
 * - ユーザー基本情報（全カラム）
 * - 投稿数
 * - フォロワー数
 * - フォロー中数
 *
 * ## 認証
 * 認証不要（公開情報として取得可能）
 *
 * @param userId - 取得対象のユーザーID
 * @returns ユーザー情報、または { error: string }
 *
 * @example
 * ```typescript
 * // プロフィールページ
 * const { user } = await getUser(params.userId)
 *
 * return (
 *   <div>
 *     <h1>{user.nickname}</h1>
 *     <p>投稿数: {user.postsCount}</p>
 *   </div>
 * )
 * ```
 */
export async function getUser(userId: string) {
  /**
   * ユーザーを取得
   *
   * include._count で関連レコードの数を集計:
   * - posts: 投稿数
   * - followers: フォロワー数
   * - following: フォロー中数
   */
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  // ------------------------------------------------------------
  // ユーザーが見つからない場合
  // ------------------------------------------------------------

  if (!user) {
    return { error: 'ユーザーが見つかりません' }
  }

  // ------------------------------------------------------------
  // 結果の整形と返却
  // ------------------------------------------------------------

  /**
   * _count を展開してフラットな形式に変換
   */
  return {
    user: {
      ...user,
      postsCount: user._count.posts,
      followersCount: user._count.followers,
      followingCount: user._count.following,
    },
  }
}

// ============================================================
// 現在のユーザー情報取得
// ============================================================

/**
 * 現在ログイン中のユーザー情報を取得
 *
 * ## 機能概要
 * セッションから現在のユーザーIDを取得し、
 * そのユーザーの情報を返します。
 *
 * ## 用途
 * - ナビゲーションバーのユーザー表示
 * - 設定ページの初期値
 *
 * @returns ユーザー情報、または { error: string }
 *
 * @example
 * ```typescript
 * const { user } = await getCurrentUser()
 *
 * if (user) {
 *   console.log(`ようこそ、${user.nickname}さん`)
 * }
 * ```
 */
export async function getCurrentUser() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ユーザー情報を取得
  // ------------------------------------------------------------

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) {
    return { error: 'ユーザー情報の取得に失敗しました' }
  }

  return { user }
}

// ============================================================
// プロフィール更新
// ============================================================

/**
 * プロフィールを更新
 *
 * ## 機能概要
 * ユーザーのプロフィール情報を更新します。
 *
 * ## 更新可能項目
 * - ニックネーム（必須）
 * - 自己紹介
 * - 居住地域
 * - 盆栽開始年
 * - 盆栽開始月
 *
 * ## バリデーション
 * Zodスキーマによる入力検証:
 * - 各フィールドの文字数制限
 * - 年月の範囲チェック
 *
 * @param formData - フォームデータ
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // プロフィール編集フォーム
 * <form action={updateProfile}>
 *   <input name="nickname" required />
 *   <textarea name="bio" />
 *   <button type="submit">保存</button>
 * </form>
 * ```
 */
export async function updateProfile(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 盆栽開始年月の処理
  // ------------------------------------------------------------

  /**
   * フォームから文字列として取得し、数値に変換
   *
   * parseInt の結果が NaN の場合は null に
   */
  const bonsaiStartYearStr = formData.get('bonsaiStartYear') as string
  const bonsaiStartMonthStr = formData.get('bonsaiStartMonth') as string
  const bonsaiStartYear = bonsaiStartYearStr ? parseInt(bonsaiStartYearStr, 10) : null
  const bonsaiStartMonth = bonsaiStartMonthStr ? parseInt(bonsaiStartMonthStr, 10) : null

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  /**
   * safeParse はエラーをスローせず、
   * 結果オブジェクト { success, data?, error? } を返す
   */
  // 生年月日の処理
  const birthDateStr = formData.get('birthDate') as string

  const result = profileSchema.safeParse({
    nickname: formData.get('nickname'),
    bio: formData.get('bio') || '',
    location: formData.get('location') || '',
    bonsaiStartYear: isNaN(bonsaiStartYear as number) ? null : bonsaiStartYear,
    bonsaiStartMonth: isNaN(bonsaiStartMonth as number) ? null : bonsaiStartMonth,
    birthDate: birthDateStr || null,
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  // ------------------------------------------------------------
  // データベース更新
  // ------------------------------------------------------------

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nickname: result.data.nickname,
      bio: result.data.bio || null,
      location: result.data.location || null,
      /**
       * ?? は Nullish Coalescing 演算子
       * 左辺が null または undefined の場合のみ右辺を返す
       */
      bonsaiStartYear: result.data.bonsaiStartYear ?? null,
      bonsaiStartMonth: result.data.bonsaiStartMonth ?? null,
      birthDate: result.data.birthDate ? new Date(result.data.birthDate) : null,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  /**
   * 関連ページのキャッシュを再検証
   */
  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true }
}

// ============================================================
// プライバシー設定更新
// ============================================================

/**
 * プライバシー設定を更新
 *
 * ## 機能概要
 * アカウントの公開/非公開設定を変更します。
 *
 * ## 公開アカウント (isPublic: true)
 * - 誰でもフォローできる
 * - 投稿が検索結果に表示される
 * - おすすめユーザーに表示される
 *
 * ## 非公開アカウント (isPublic: false)
 * - フォローリクエストが必要（未実装）
 * - 投稿が検索結果に表示されない
 * - おすすめユーザーに表示されない
 *
 * @param isPublic - 公開設定（true: 公開、false: 非公開）
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // プライバシー設定トグル
 * const handleToggle = async () => {
 *   const result = await updatePrivacy(!isPublic)
 *   if (result.success) {
 *     setIsPublic(!isPublic)
 *   }
 * }
 * ```
 */
export async function updatePrivacy(isPublic: boolean) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // データベース更新
  // ------------------------------------------------------------

  await prisma.user.update({
    where: { id: session.user.id },
    data: { isPublic },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/account')
  return { success: true }
}

// ============================================================
// アバター画像アップロード
// ============================================================

/**
 * アバター画像をアップロード
 *
 * ## 機能概要
 * ユーザーのプロフィール画像（アバター）をアップロードします。
 *
 * ## 制限
 * - ファイルサイズ: 4MB以下
 * - 対応形式: JPEG、PNG、WebP
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. ファイルの存在チェック
 * 3. ファイルサイズチェック
 * 4. MIMEタイプチェック
 * 5. ストレージにアップロード
 * 6. データベースのURLを更新
 * 7. キャッシュを再検証
 *
 * @param formData - アップロードするファイルを含むFormData
 * @returns 成功時は { success: true, url: string }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // アバターアップロードフォーム
 * const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0]
 *   if (!file) return
 *
 *   const formData = new FormData()
 *   formData.append('file', file)
 *
 *   const result = await uploadAvatar(formData)
 *   if (result.success) {
 *     setAvatarUrl(result.url)
 *   }
 * }
 * ```
 */
export async function uploadAvatar(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ファイルの存在チェック
  // ------------------------------------------------------------

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ------------------------------------------------------------
  // ファイルサイズチェック（4MB）
  // ------------------------------------------------------------

  /**
   * 4 * 1024 * 1024 = 4,194,304 bytes = 4MB
   */
  if (file.size > 4 * 1024 * 1024) {
    return { error: 'ファイルサイズは4MB以下にしてください' }
  }

  // ------------------------------------------------------------
  // MIMEタイプチェック
  // ------------------------------------------------------------

  /**
   * 許可されたMIMEタイプのリスト
   * WebPは次世代画像フォーマットで、JPEGより高圧縮
   */
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'JPEG、PNG、WebP形式のみ対応しています' }
  }

  // ------------------------------------------------------------
  // ストレージにアップロード
  // ------------------------------------------------------------

  /**
   * File を Buffer に変換
   *
   * arrayBuffer() は File を ArrayBuffer として読み込む
   * Buffer.from() で Node.js の Buffer に変換
   */
  const buffer = Buffer.from(await file.arrayBuffer())

  // ------------------------------------------------------------
  // ファイルシグネチャ検証（MIMEタイプ偽装防止）
  // ------------------------------------------------------------

  /**
   * ファイルの先頭バイト（マジックバイト）を検証し、
   * 実際のファイル形式が主張されたMIMEタイプと一致するか確認
   */
  const validation = validateImageFile(buffer, file.type, allowedTypes)
  if (!validation.valid) {
    return { error: validation.error || '無効な画像ファイルです' }
  }

  // ------------------------------------------------------------
  // 安全なファイル名を生成（パストラバーサル防止）
  // ------------------------------------------------------------

  /**
   * 元のファイル名を使用せず、UUIDベースの安全なファイル名を生成
   * これにより「../../etc/passwd」のような攻撃を防止
   */
  const safeFileName = generateSafeFileName(file.name, file.type)

  /**
   * uploadFile 関数でストレージにアップロード
   *
   * 環境に応じてローカル or Azure Blob Storage を使用
   * 'avatars' フォルダに保存
   */
  const result = await uploadFile(buffer, safeFileName, file.type, 'avatars')

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  // ------------------------------------------------------------
  // データベース更新
  // ------------------------------------------------------------

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: result.url },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true, url: result.url }
}

// ============================================================
// ヘッダー画像アップロード
// ============================================================

/**
 * ヘッダー画像をアップロード
 *
 * ## 機能概要
 * ユーザーのプロフィールヘッダー画像をアップロードします。
 *
 * ## 制限
 * - ファイルサイズ: 4MB以下
 * - 対応形式: JPEG、PNG、WebP
 *
 * ## アバターとの違い
 * - 保存先フォルダ: 'headers'
 * - 更新フィールド: headerUrl
 *
 * @param formData - アップロードするファイルを含むFormData
 * @returns 成功時は { success: true, url: string }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // ヘッダーアップロードフォーム
 * const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0]
 *   if (!file) return
 *
 *   const formData = new FormData()
 *   formData.append('file', file)
 *
 *   const result = await uploadHeader(formData)
 *   if (result.success) {
 *     setHeaderUrl(result.url)
 *   }
 * }
 * ```
 */
export async function uploadHeader(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ファイルの存在チェック
  // ------------------------------------------------------------

  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  // ------------------------------------------------------------
  // ファイルサイズチェック（4MB）
  // ------------------------------------------------------------

  if (file.size > 4 * 1024 * 1024) {
    return { error: 'ファイルサイズは4MB以下にしてください' }
  }

  // ------------------------------------------------------------
  // MIMEタイプチェック
  // ------------------------------------------------------------

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'JPEG、PNG、WebP形式のみ対応しています' }
  }

  // ------------------------------------------------------------
  // ストレージにアップロード
  // ------------------------------------------------------------

  /**
   * 'headers' フォルダに保存
   */
  const buffer = Buffer.from(await file.arrayBuffer())

  // ------------------------------------------------------------
  // ファイルシグネチャ検証（MIMEタイプ偽装防止）
  // ------------------------------------------------------------

  /**
   * ファイルの先頭バイト（マジックバイト）を検証し、
   * 実際のファイル形式が主張されたMIMEタイプと一致するか確認
   */
  const validation = validateImageFile(buffer, file.type, allowedTypes)
  if (!validation.valid) {
    return { error: validation.error || '無効な画像ファイルです' }
  }

  // ------------------------------------------------------------
  // 安全なファイル名を生成（パストラバーサル防止）
  // ------------------------------------------------------------

  /**
   * 元のファイル名を使用せず、UUIDベースの安全なファイル名を生成
   * これにより「../../etc/passwd」のような攻撃を防止
   */
  const safeFileName = generateSafeFileName(file.name, file.type)

  const result = await uploadFile(buffer, safeFileName, file.type, 'headers')

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  // ------------------------------------------------------------
  // データベース更新
  // ------------------------------------------------------------

  await prisma.user.update({
    where: { id: session.user.id },
    data: { headerUrl: result.url },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証と結果返却
  // ------------------------------------------------------------

  revalidatePath(`/users/${session.user.id}`)
  revalidatePath('/settings/profile')
  return { success: true, url: result.url }
}

// ============================================================
// アカウント削除
// ============================================================

/**
 * アカウントを削除
 *
 * ## 機能概要
 * ユーザーアカウントを完全に削除します。
 *
 * ## 削除される関連データ
 * Prismaのカスケード削除により、以下が自動削除:
 * - 投稿
 * - コメント
 * - いいね
 * - ブックマーク
 * - フォロー関係
 * - 通知
 *
 * ## 注意
 * この操作は取り消せません。
 *
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * // アカウント削除確認ダイアログ
 * const handleDelete = async () => {
 *   if (confirm('本当にアカウントを削除しますか？')) {
 *     const result = await deleteAccount()
 *     if (result.success) {
 *       signOut()
 *     }
 *   }
 * }
 * ```
 */
export async function deleteAccount() {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const userId = session.user.id

  // ------------------------------------------------------------
  // トランザクションで全データを削除
  // ------------------------------------------------------------

  try {
    await prisma.$transaction(async (tx) => {
      // UserAnalytics を明示的に削除（リレーションが後から追加されたため）
      await tx.userAnalytics.deleteMany({
        where: { userId },
      })

      // メッセージ関連
      await tx.message.deleteMany({
        where: { senderId: userId },
      })

      await tx.conversationParticipant.deleteMany({
        where: { userId },
      })

      // 通知関連（actor として送った通知も削除）
      await tx.notification.deleteMany({
        where: {
          OR: [
            { userId },
            { actorId: userId },
          ],
        },
      })

      // ユーザーを削除（カスケード削除で残りのデータも削除される）
      await tx.user.delete({
        where: { id: userId },
      })
    })

    return { success: true }
  } catch (error) {
    console.error('Account deletion error:', error)
    return { error: 'アカウントの削除に失敗しました' }
  }
}

// ============================================================
// フォロワー一覧取得
// ============================================================

/**
 * フォロワー一覧を取得
 *
 * ## 機能概要
 * 指定されたユーザーのフォロワー一覧を取得します。
 *
 * ## 用途
 * - プロフィールページの「フォロワー」タブ
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 *
 * @param userId - 対象のユーザーID
 * @param cursor - ページネーション用カーソル
 * @returns フォロワー一覧
 *
 * @example
 * ```typescript
 * const { followers } = await getFollowers(userId)
 *
 * return (
 *   <ul>
 *     {followers.map(user => (
 *       <UserCard key={user.id} user={user} />
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function getFollowers(userId: string, cursor?: string) {
  /**
   * フォロー関係を取得
   *
   * where: { followingId: userId }
   * → userId をフォローしている人（＝フォロワー）を取得
   *
   * include.follower でフォロワーのユーザー情報を結合
   */
  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    include: {
      follower: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    /**
     * カーソルベースページネーション
     *
     * 複合ユニークキー followerId_followingId を使用
     */
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: cursor,
          followingId: userId,
        },
      },
      skip: 1,
    }),
  })

  /**
   * フォロワーのユーザー情報のみを抽出
   */
  return { followers: follows.map((f: typeof follows[number]) => f.follower) }
}

// ============================================================
// フォロー中一覧取得
// ============================================================

/**
 * フォロー中一覧を取得
 *
 * ## 機能概要
 * 指定されたユーザーがフォローしているユーザーの一覧を取得します。
 *
 * ## 用途
 * - プロフィールページの「フォロー中」タブ
 *
 * ## フォロワー取得との違い
 * - フォロワー: followingId = userId（自分をフォローしている人）
 * - フォロー中: followerId = userId（自分がフォローしている人）
 *
 * @param userId - 対象のユーザーID
 * @param cursor - ページネーション用カーソル
 * @returns フォロー中一覧
 *
 * @example
 * ```typescript
 * const { following } = await getFollowing(userId)
 *
 * return (
 *   <ul>
 *     {following.map(user => (
 *       <UserCard key={user.id} user={user} />
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function getFollowing(userId: string, cursor?: string) {
  /**
   * フォロー関係を取得
   *
   * where: { followerId: userId }
   * → userId がフォローしている人を取得
   *
   * include.following でフォロー先のユーザー情報を結合
   */
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    include: {
      following: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    /**
     * カーソルベースページネーション
     *
     * 複合ユニークキー followerId_followingId を使用
     */
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: userId,
          followingId: cursor,
        },
      },
      skip: 1,
    }),
  })

  /**
   * フォロー先のユーザー情報のみを抽出
   */
  return { following: follows.map((f: typeof follows[number]) => f.following) }
}

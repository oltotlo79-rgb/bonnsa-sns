/**
 * 盆栽園レビュー機能のServer Actions
 *
 * このファイルは、盆栽園に対するレビュー（口コミ）機能に関する
 * サーバーサイドの処理を提供します。
 *
 * ## 機能概要
 * - レビューの投稿（1店舗につき1ユーザー1件）
 * - レビューの編集・削除（所有者のみ）
 * - レビュー一覧の取得（カーソルページネーション）
 * - レビュー画像のアップロード
 *
 * ## レビューの構成
 * - 評価（1〜5の星評価）
 * - テキストコメント（任意）
 * - 画像（最大3枚、任意）
 *
 * ## セキュリティ
 * - 全操作で認証必須
 * - 編集・削除は所有者のみ
 * - 同一店舗への重複投稿防止
 *
 * @module lib/actions/review
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
 * キャッシュ再検証関数
 * 更新後にページを再レンダリングするために使用
 */
import { revalidatePath } from 'next/cache'

// ============================================================
// 定数
// ============================================================

/**
 * レビュー画像の最大枚数
 */
const MAX_REVIEW_IMAGES = 3

/**
 * 評価の最小値
 */
const MIN_RATING = 1

/**
 * 評価の最大値
 */
const MAX_RATING = 5

/**
 * 画像の最大サイズ（5MB）
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

// ============================================================
// レビュー投稿
// ============================================================

/**
 * 新しいレビューを投稿
 *
 * ## 機能概要
 * 盆栽園に対するレビュー（評価とコメント）を投稿します。
 * 1つの盆栽園につき1ユーザー1件のみ投稿可能です。
 *
 * ## バリデーション
 * - 盆栽園IDは必須
 * - 評価は1〜5の整数
 * - 画像は3枚まで
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. フォームデータの取得
 * 3. バリデーション
 * 4. 盆栽園の存在確認
 * 5. 重複投稿チェック
 * 6. レビュー作成
 * 7. キャッシュ再検証
 *
 * @param formData - フォームデータ
 * @param formData.shopId - 盆栽園ID
 * @param formData.rating - 評価（1〜5）
 * @param formData.content - コメント（任意）
 * @param formData.imageUrls - 画像URL配列（最大3枚）
 * @returns 成功時: { success: true, reviewId }, 失敗時: { error: string }
 *
 * @example
 * ```typescript
 * // フォームからの送信
 * <form action={createReview}>
 *   <input type="hidden" name="shopId" value={shop.id} />
 *   <StarRating name="rating" />
 *   <textarea name="content" placeholder="コメント（任意）" />
 *   {imageUrls.map(url => (
 *     <input type="hidden" name="imageUrls" value={url} key={url} />
 *   ))}
 *   <button type="submit">レビューを投稿</button>
 * </form>
 * ```
 */
export async function createReview(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  /**
   * セッションを取得してログイン状態を確認
   * 未ログインの場合はエラーを返す
   */
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  /**
   * formData.get() で単一の値を取得
   * formData.getAll() で同名フィールドの全値を配列で取得
   */
  const shopId = formData.get('shopId') as string
  const ratingStr = formData.get('rating') as string
  const content = formData.get('content') as string | null
  const imageUrls = formData.getAll('imageUrls') as string[]

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  /**
   * 盆栽園ID必須チェック
   */
  if (!shopId) {
    return { error: '盆栽園IDが必要です' }
  }

  /**
   * 評価値のパースと範囲チェック
   *
   * parseInt(string, 10) で10進数としてパース
   * NaN（非数値）または範囲外の場合はエラー
   */
  const rating = parseInt(ratingStr, 10)
  if (isNaN(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return { error: '評価は1〜5の間で選択してください' }
  }

  /**
   * 画像枚数チェック
   * 3枚を超える場合はエラー
   */
  if (imageUrls.length > MAX_REVIEW_IMAGES) {
    return { error: '画像は3枚までです' }
  }

  // ------------------------------------------------------------
  // 盆栽園の存在確認
  // ------------------------------------------------------------

  /**
   * 対象の盆栽園が存在するか確認
   * 存在しない場合はエラーを返す
   */
  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
  })

  if (!shop) {
    return { error: '盆栽園が見つかりません' }
  }

  // ------------------------------------------------------------
  // 重複投稿チェック
  // ------------------------------------------------------------

  /**
   * 同一ユーザーが同一店舗に既にレビューを投稿していないか確認
   *
   * findFirst は最初にマッチしたレコードを返す
   * 存在する場合は重複エラー
   */
  const existingReview = await prisma.shopReview.findFirst({
    where: {
      shopId,
      userId: session.user.id,
    },
  })

  if (existingReview) {
    return { error: 'この盆栽園には既にレビューを投稿しています' }
  }

  // ------------------------------------------------------------
  // レビュー作成
  // ------------------------------------------------------------

  /**
   * レビューをデータベースに作成
   *
   * ## 画像のネストした作成
   * images フィールドに画像がある場合のみ
   * create でリレーションを同時に作成
   *
   * ## content の処理
   * - trim() で前後の空白を除去
   * - 空文字の場合は null
   */
  const review = await prisma.shopReview.create({
    data: {
      shopId,
      userId: session.user.id,
      rating,
      content: content?.trim() || null,
      /**
       * 条件付きでリレーションを作成
       *
       * imageUrls.length > 0 の場合のみ images を作成
       * そうでなければ undefined（フィールドを設定しない）
       */
      images: imageUrls.length > 0
        ? {
            create: imageUrls.map((url: string) => ({ url })),
          }
        : undefined,
    },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証
  // ------------------------------------------------------------

  /**
   * 盆栽園詳細ページのキャッシュを無効化
   * 新しいレビューが表示されるようにする
   */
  revalidatePath(`/shops/${shopId}`)

  return { success: true, reviewId: review.id }
}

// ============================================================
// レビュー編集
// ============================================================

/**
 * 既存のレビューを編集
 *
 * ## 機能概要
 * 自分が投稿したレビューの評価、コメント、画像を更新します。
 *
 * ## セキュリティ
 * 所有者のみが編集可能です。
 *
 * @param reviewId - 編集するレビューのID
 * @param formData - フォームデータ
 * @param formData.rating - 新しい評価（1〜5）
 * @param formData.content - 新しいコメント（任意）
 * @param formData.imageUrls - 新たに追加する画像URL配列（任意）
 * @param formData.deleteImageIds - 削除する画像ID配列（任意）
 * @returns 成功時: { success: true }, 失敗時: { error: string }
 */
export async function updateReview(reviewId: string, formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // フォームデータの取得
  // ------------------------------------------------------------

  const ratingStr = formData.get('rating') as string
  const content = formData.get('content') as string | null
  const newImageUrls = formData.getAll('imageUrls') as string[]
  const deleteImageIds = formData.getAll('deleteImageIds') as string[]

  // ------------------------------------------------------------
  // 所有者確認
  // ------------------------------------------------------------

  /**
   * レビューを取得して所有者を確認
   * 既存の画像数も取得して制限チェックに使用
   */
  const review = await prisma.shopReview.findUnique({
    where: { id: reviewId },
    select: {
      userId: true,
      shopId: true,
      images: { select: { id: true } },
    },
  })

  if (!review) {
    return { error: 'レビューが見つかりません' }
  }

  /**
   * 所有者でない場合は編集を拒否
   */
  if (review.userId !== session.user.id) {
    return { error: '編集権限がありません' }
  }

  // ------------------------------------------------------------
  // バリデーション
  // ------------------------------------------------------------

  const rating = parseInt(ratingStr, 10)
  if (isNaN(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return { error: '評価は1〜5の間で選択してください' }
  }

  // 画像の総数チェック（既存 - 削除 + 新規 <= 3）
  const existingImageCount = review.images.length
  const remainingImageCount = existingImageCount - deleteImageIds.length
  const totalImageCount = remainingImageCount + newImageUrls.length

  if (totalImageCount > MAX_REVIEW_IMAGES) {
    return { error: '画像は3枚までです' }
  }

  // ------------------------------------------------------------
  // レビュー更新（トランザクション）
  // ------------------------------------------------------------

  await prisma.$transaction(async (tx) => {
    // 画像の削除
    if (deleteImageIds.length > 0) {
      await tx.shopReviewImage.deleteMany({
        where: {
          id: { in: deleteImageIds },
          reviewId: reviewId,
        },
      })
    }

    // 新しい画像の追加
    if (newImageUrls.length > 0) {
      await tx.shopReviewImage.createMany({
        data: newImageUrls.map((url: string) => ({
          reviewId: reviewId,
          url,
        })),
      })
    }

    // レビュー本体の更新
    await tx.shopReview.update({
      where: { id: reviewId },
      data: {
        rating,
        content: content?.trim() || null,
      },
    })
  })

  // ------------------------------------------------------------
  // キャッシュ再検証
  // ------------------------------------------------------------

  revalidatePath(`/shops/${review.shopId}`)

  return { success: true }
}

// ============================================================
// レビュー削除
// ============================================================

/**
 * レビューを削除
 *
 * ## 機能概要
 * 自分が投稿したレビューを削除します。
 * 関連する画像も自動的に削除されます（Prismaのカスケード削除）。
 *
 * ## セキュリティ
 * 所有者のみが削除可能です。
 *
 * @param reviewId - 削除するレビューのID
 * @returns 成功時: { success: true }, 失敗時: { error: string }
 *
 * @example
 * ```typescript
 * // 削除ボタンのクリックハンドラ
 * async function handleDelete() {
 *   if (confirm('本当に削除しますか？')) {
 *     const result = await deleteReview(review.id)
 *     if (result.success) {
 *       toast.success('レビューを削除しました')
 *     }
 *   }
 * }
 * ```
 */
export async function deleteReview(reviewId: string) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // 所有者確認
  // ------------------------------------------------------------

  /**
   * レビューを取得して所有者を確認
   */
  const review = await prisma.shopReview.findUnique({
    where: { id: reviewId },
    select: { userId: true, shopId: true },
  })

  if (!review) {
    return { error: 'レビューが見つかりません' }
  }

  /**
   * 所有者でない場合は削除を拒否
   */
  if (review.userId !== session.user.id) {
    return { error: '削除権限がありません' }
  }

  // ------------------------------------------------------------
  // レビュー削除
  // ------------------------------------------------------------

  /**
   * レビューを削除
   *
   * Prismaスキーマでカスケード削除が設定されている場合、
   * 関連する ReviewImage も自動的に削除される
   */
  await prisma.shopReview.delete({
    where: { id: reviewId },
  })

  // ------------------------------------------------------------
  // キャッシュ再検証
  // ------------------------------------------------------------

  revalidatePath(`/shops/${review.shopId}`)

  return { success: true }
}

// ============================================================
// レビュー一覧取得
// ============================================================

/**
 * 盆栽園のレビュー一覧を取得
 *
 * ## 機能概要
 * 指定した盆栽園のレビューをカーソルベースの
 * ページネーションで取得します。
 *
 * ## カーソルベースページネーション
 * オフセット方式（ページ番号指定）と異なり、
 * 「このIDの次から取得」という方式です。
 *
 * メリット:
 * - データの追加・削除があっても正確
 * - 大量データでもパフォーマンスが落ちない
 *
 * @param shopId - 盆栽園ID
 * @param cursor - 前回の最後のレビューID（ページネーション用）
 * @param limit - 取得件数（デフォルト: 10）
 * @returns レビュー配列と次のカーソル
 *
 * @example
 * ```typescript
 * // 初回ロード
 * const { reviews, nextCursor } = await getReviews(shopId)
 *
 * // 「もっと見る」クリック時
 * const more = await getReviews(shopId, nextCursor)
 *
 * // React Query での使用例
 * const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
 *   queryKey: ['reviews', shopId],
 *   queryFn: ({ pageParam }) => getReviews(shopId, pageParam),
 *   getNextPageParam: (lastPage) => lastPage.nextCursor,
 * })
 * ```
 */
export async function getReviews(shopId: string, cursor?: string, limit = 10) {
  // ------------------------------------------------------------
  // レビュー取得
  // ------------------------------------------------------------

  /**
   * レビューを取得（カーソルページネーション）
   *
   * ## クエリの解説
   * - where: 対象店舗のレビューのみ
   * - include: ユーザー情報と画像を含める
   * - orderBy: 新しい順
   * - take: limit件取得
   * - cursor: 指定IDの次から取得（オプション）
   * - skip: カーソル自体をスキップ
   */
  const reviews = await prisma.shopReview.findMany({
    where: { shopId },
    include: {
      /**
       * 投稿者の情報を取得
       * select で必要なフィールドのみに限定
       */
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      /**
       * レビューに添付された画像を全て取得
       */
      images: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    /**
     * カーソルが指定されている場合のみ設定
     *
     * スプレッド構文 (...) で条件付きでオブジェクトをマージ
     * cursor && { ... } は cursor が truthy な場合のみ展開
     */
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,  // カーソル位置のレコードをスキップ
    }),
  })

  // ------------------------------------------------------------
  // ページネーション情報の計算
  // ------------------------------------------------------------

  /**
   * 次のページがあるかどうか判定
   *
   * limit件取得できた = まだデータが残っている可能性がある
   */
  const hasMore = reviews.length === limit

  return {
    reviews,
    /**
     * 次のカーソル
     *
     * まだデータがある場合は最後のレビューのIDを返す
     * ない場合は undefined
     */
    nextCursor: hasMore ? reviews[reviews.length - 1]?.id : undefined,
  }
}

// ============================================================
// レビュー画像アップロード
// ============================================================

/**
 * レビュー用画像をアップロード
 *
 * ## 機能概要
 * レビューに添付する画像をストレージにアップロードし、
 * URLを返します。
 *
 * ## バリデーション
 * - 画像ファイル形式のみ許可
 * - 最大5MB
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. ファイル取得
 * 3. 形式・サイズチェック
 * 4. ストレージにアップロード
 * 5. URLを返却
 *
 * @param formData - ファイルを含むフォームデータ
 * @param formData.file - アップロードする画像ファイル
 * @returns 成功時: { success: true, url }, 失敗時: { error: string }
 *
 * @example
 * ```typescript
 * // input[type="file"] の onChange ハンドラ
 * async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
 *   const file = e.target.files?.[0]
 *   if (!file) return
 *
 *   const formData = new FormData()
 *   formData.append('file', file)
 *
 *   const result = await uploadReviewImage(formData)
 *   if (result.success) {
 *     setImageUrls(prev => [...prev, result.url])
 *   }
 * }
 * ```
 */
export async function uploadReviewImage(formData: FormData) {
  // ------------------------------------------------------------
  // 認証チェック
  // ------------------------------------------------------------

  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  // ------------------------------------------------------------
  // ファイル取得とバリデーション
  // ------------------------------------------------------------

  /**
   * FormDataからファイルを取得
   *
   * formData.get('file') は FormDataEntryValue 型を返すので
   * as File でキャスト
   */
  const file = formData.get('file') as File
  if (!file) {
    return { error: 'ファイルが選択されていません' }
  }

  /**
   * MIMEタイプで画像かどうかをチェック
   *
   * file.type は 'image/jpeg', 'image/png' などの形式
   * startsWith('image/') で画像系のMIMEタイプを全て許可
   */
  if (!file.type.startsWith('image/')) {
    return { error: '画像ファイルを選択してください' }
  }

  /**
   * ファイルサイズチェック
   *
   * file.size はバイト単位
   * 5 * 1024 * 1024 = 5MB
   */
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: '画像は5MB以下にしてください' }
  }

  // ------------------------------------------------------------
  // ストレージにアップロード
  // ------------------------------------------------------------

  /**
   * ストレージモジュールを動的インポート
   *
   * 動的インポートにより、ストレージが不要な場合は
   * コードがロードされない（バンドルサイズ削減）
   */
  const { uploadFile } = await import('@/lib/storage')

  /**
   * ファイルをBufferに変換
   *
   * 1. file.arrayBuffer() で ArrayBuffer を取得
   * 2. Buffer.from() で Node.js の Buffer に変換
   *
   * Buffer はバイナリデータを扱うための Node.js 固有の型
   */
  const buffer = Buffer.from(await file.arrayBuffer())

  /**
   * ストレージにアップロード
   *
   * @param buffer - ファイルのバイナリデータ
   * @param file.name - 元のファイル名
   * @param file.type - MIMEタイプ
   * @param 'review-images' - 保存先フォルダ名
   */
  const result = await uploadFile(buffer, file.name, file.type, 'review-images')

  // ------------------------------------------------------------
  // 結果を返却
  // ------------------------------------------------------------

  if (!result.success || !result.url) {
    return { error: result.error || 'アップロードに失敗しました' }
  }

  return { success: true, url: result.url }
}

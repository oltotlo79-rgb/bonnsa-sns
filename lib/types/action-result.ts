/**
 * Server Actions用の共通戻り値型定義
 *
 * このファイルは、Next.js Server Actions で使用する
 * 戻り値の型を統一的に定義します。
 *
 * ## なぜ統一された型が必要か？
 *
 * ### 1. 一貫性のあるエラーハンドリング
 * 全てのServer Actionsが同じ形式で結果を返すことで、
 * クライアント側のエラーハンドリングが統一されます。
 *
 * ### 2. 型安全性
 * TypeScriptの型システムを活用して、
 * 成功/失敗の判定を安全に行えます。
 *
 * ### 3. 開発効率
 * ヘルパー関数（success, error）を使うことで、
 * ボイラープレートコードを削減できます。
 *
 * ## 使用パターン
 *
 * ### パターン1: 単純な成功/失敗
 * ```typescript
 * async function deletePost(id: string): Promise<ActionResult> {
 *   if (!authorized) return error('権限がありません')
 *   await prisma.post.delete({ where: { id } })
 *   return success()
 * }
 * ```
 *
 * ### パターン2: データを返す
 * ```typescript
 * async function createPost(data): Promise<ActionResult<{ postId: string }>> {
 *   const post = await prisma.post.create({ data })
 *   return success({ postId: post.id })
 * }
 * ```
 *
 * ### パターン3: データ取得
 * ```typescript
 * async function getPosts(): Promise<FetchResult<{ posts: Post[] }>> {
 *   const posts = await prisma.post.findMany()
 *   return { posts }  // 直接データを返す
 * }
 * ```
 *
 * @module lib/types/action-result
 */

// ============================================================
// 基本結果型
// ============================================================

/**
 * エラー結果の型
 *
 * ## プロパティ
 * - error: エラーメッセージ（必須）
 * - success?: never - 成功フラグは存在しない
 *
 * ## never 型の意味
 * `success?: never` は「successプロパティが存在してはならない」ことを示します。
 * これにより、エラー結果と成功結果を明確に区別できます。
 *
 * ## 使用例
 * ```typescript
 * const result: ErrorResult = { error: '投稿が見つかりません' }
 *
 * // これはエラー！ success プロパティは許可されない
 * const wrong: ErrorResult = { error: 'エラー', success: true }
 * ```
 */
export interface ErrorResult {
  error: string
  success?: never
}

/**
 * 成功結果の型（ジェネリック）
 *
 * ## 型パラメータ
 * @template T - 成功時に返すデータの型（デフォルト: void）
 *
 * ## プロパティ
 * - success: true（必須、リテラル型）
 * - error?: never - エラーは存在しない
 * - data?: T - オプショナルなデータ
 *
 * ## 使用例
 * ```typescript
 * // データなし
 * const result1: SuccessResult = { success: true }
 *
 * // データあり
 * const result2: SuccessResult<{ id: string }> = {
 *   success: true,
 *   data: { id: 'abc123' }
 * }
 * ```
 */
export interface SuccessResult<T = void> {
  success: true
  error?: never
  data?: T
}

/**
 * データ結果の型
 *
 * ## 目的
 * 成功/失敗フラグなしで直接データを返す場合に使用。
 * 主にデータ取得系のServer Actionsで使用されます。
 *
 * ## プロパティ
 * - error?: never - エラーは存在しない
 * - success?: never - 成功フラグも存在しない
 * - data: T - 必須のデータ
 *
 * ## 使用例
 * ```typescript
 * const result: DataResult<{ posts: Post[] }> = {
 *   data: { posts: [...] }
 * }
 * ```
 *
 * ## 注意
 * エラー時は ErrorResult を返すため、
 * この型単体では使用せず FetchResult と組み合わせます。
 */
export interface DataResult<T> {
  error?: never
  success?: never
  data: T
}

// ============================================================
// 複合結果型
// ============================================================

/**
 * Server Actionの標準的な戻り値型
 *
 * ## 成功時
 * - データなし: { success: true }
 * - データあり: { success: true, ...data }
 *
 * ## 失敗時
 * - { error: "エラーメッセージ" }
 *
 * ## 型パラメータ
 * @template T - 成功時に返す追加データの型（デフォルト: void）
 *
 * ## 条件型の解説
 * ```typescript
 * T extends void
 *   ? { success: true; error?: never }  // T が void なら
 *   : { success: true; error?: never } & T  // T があれば T とマージ
 * ```
 *
 * ## 使用例
 * ```typescript
 * // データなしのアクション
 * async function likePost(id: string): Promise<ActionResult> {
 *   // ...
 *   return { success: true }
 * }
 *
 * // データありのアクション
 * async function createPost(data): Promise<ActionResult<{ postId: string }>> {
 *   // ...
 *   return { success: true, postId: 'abc123' }
 * }
 *
 * // クライアント側での使用
 * const result = await createPost(formData)
 * if (result.error) {
 *   toast.error(result.error)
 * } else {
 *   router.push(`/posts/${result.postId}`)
 * }
 * ```
 */
export type ActionResult<T = void> =
  | ErrorResult
  | (T extends void ? { success: true; error?: never } : { success: true; error?: never } & T)

/**
 * データ取得系の戻り値型
 *
 * ## 成功時
 * データを直接返す（successフラグなし）
 * 例: { posts: [...], nextCursor: "..." }
 *
 * ## 失敗時
 * エラーメッセージを返す
 * 例: { error: "エラーメッセージ" }
 *
 * ## ActionResult との違い
 * - ActionResult: 操作の成功/失敗を返す（作成、更新、削除など）
 * - FetchResult: データを取得して返す（読み取り専用操作）
 *
 * ## 使用例
 * ```typescript
 * // Server Action
 * async function getPosts(cursor?: string): Promise<FetchResult<PostsResponse>> {
 *   try {
 *     const posts = await prisma.post.findMany({ ... })
 *     return { posts, nextCursor: posts[posts.length - 1]?.id }
 *   } catch {
 *     return { error: '投稿の取得に失敗しました' }
 *   }
 * }
 *
 * // クライアント側
 * const result = await getPosts()
 * if ('error' in result) {
 *   toast.error(result.error)
 * } else {
 *   setPosts(result.posts)
 * }
 * ```
 */
export type FetchResult<T> = ErrorResult | T

// ============================================================
// ページネーション型
// ============================================================

/**
 * ページネーション付きリスト結果
 *
 * ## 無限スクロールの実装に使用
 * カーソルベースのページネーションをサポートする標準的な形式。
 *
 * ## プロパティ
 * - items: T[] - 取得したアイテムの配列
 * - nextCursor?: string - 次のページを取得するためのカーソル
 * - hasMore?: boolean - 追加のアイテムがあるかどうか
 *
 * ## カーソルベースページネーションとは？
 * ページ番号の代わりに、最後のアイテムのIDをカーソルとして使用。
 * メリット:
 * - 新規データ追加時にズレが発生しない
 * - パフォーマンスが良い（OFFSET を使わない）
 *
 * ## 使用例
 * ```typescript
 * async function getPosts(cursor?: string): Promise<PaginatedResult<Post>> {
 *   const posts = await prisma.post.findMany({
 *     take: 21,  // +1 で hasMore を判定
 *     cursor: cursor ? { id: cursor } : undefined,
 *     skip: cursor ? 1 : 0,  // カーソル自体をスキップ
 *   })
 *
 *   const hasMore = posts.length > 20
 *   const items = hasMore ? posts.slice(0, 20) : posts
 *
 *   return {
 *     items,
 *     nextCursor: items[items.length - 1]?.id,
 *     hasMore,
 *   }
 * }
 * ```
 */
export interface PaginatedResult<T> {
  items: T[]
  nextCursor?: string
  hasMore?: boolean
}

// ============================================================
// 型ガード関数
// ============================================================

/**
 * エラー結果かどうかを判定する型ガード
 *
 * ## 型ガードとは？
 * TypeScriptに対して「この条件が真なら、変数はこの型である」と
 * 教える特別な関数です。
 *
 * ## 戻り値の型 `result is ErrorResult`
 * この関数が true を返した場合、TypeScriptは
 * result を ErrorResult 型として扱います。
 *
 * ## 判定ロジック
 * 1. result が null でない
 * 2. result がオブジェクトである
 * 3. 'error' プロパティが存在する
 * 4. error プロパティが文字列である
 *
 * ## 使用例
 * ```typescript
 * const result = await someAction()
 *
 * if (isErrorResult(result)) {
 *   // ここでは result は ErrorResult 型
 *   console.error(result.error)  // 型安全！
 * } else {
 *   // ここでは result は成功型
 *   console.log(result.data)
 * }
 * ```
 */
export function isErrorResult(result: unknown): result is ErrorResult {
  return result !== null && typeof result === 'object' && 'error' in result && typeof (result as ErrorResult).error === 'string'
}

/**
 * 成功結果かどうかを判定する型ガード
 *
 * ## 判定ロジック
 * 1. result が null でない
 * 2. result がオブジェクトである
 * 3. 'success' プロパティが存在する
 * 4. success プロパティが true である
 *
 * ## 使用例
 * ```typescript
 * const result = await createPost(data)
 *
 * if (isSuccessResult(result)) {
 *   // ここでは result は { success: true } を含む型
 *   toast.success('投稿を作成しました')
 *   router.refresh()
 * }
 * ```
 */
export function isSuccessResult(result: unknown): result is { success: true } {
  return result !== null && typeof result === 'object' && 'success' in result && (result as { success: boolean }).success === true
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 成功結果を作成するヘルパー関数
 *
 * ## 関数オーバーロード
 * TypeScriptの関数オーバーロードを使用して、
 * 引数の有無で異なる戻り値の型を提供します。
 *
 * ### オーバーロード1: データなし
 * ```typescript
 * function success(): { success: true }
 * ```
 *
 * ### オーバーロード2: データあり
 * ```typescript
 * function success<T>(data: T): { success: true } & T
 * ```
 *
 * ## 実装の解説
 * ```typescript
 * if (data) {
 *   return { success: true as const, ...data }
 *   // as const: success を true リテラル型として扱う
 *   // ...data: データオブジェクトを展開してマージ
 * }
 * return { success: true as const }
 * ```
 *
 * ## 使用例
 * ```typescript
 * // データなし
 * return success()
 * // 結果: { success: true }
 *
 * // データあり
 * return success({ postId: 'abc123', message: '作成しました' })
 * // 結果: { success: true, postId: 'abc123', message: '作成しました' }
 * ```
 */
export function success(): { success: true }
export function success<T extends Record<string, unknown>>(data: T): { success: true } & T
export function success<T extends Record<string, unknown>>(data?: T) {
  if (data) {
    return { success: true as const, ...data }
  }
  return { success: true as const }
}

/**
 * エラー結果を作成するヘルパー関数
 *
 * ## 機能概要
 * エラーメッセージを受け取り、ErrorResult オブジェクトを返します。
 *
 * ## パラメータ
 * @param message - エラーメッセージ
 *
 * ## 戻り値
 * @returns ErrorResult - { error: message }
 *
 * ## 使用例
 * ```typescript
 * // 認証エラー
 * if (!session) {
 *   return error('ログインが必要です')
 * }
 *
 * // バリデーションエラー
 * if (!content.trim()) {
 *   return error('内容を入力してください')
 * }
 *
 * // 権限エラー
 * if (post.userId !== session.user.id) {
 *   return error('この投稿を削除する権限がありません')
 * }
 *
 * // データベースエラー
 * try {
 *   await prisma.post.create({ data })
 * } catch (e) {
 *   return error('投稿の作成に失敗しました')
 * }
 * ```
 */
export function error(message: string): ErrorResult {
  return { error: message }
}

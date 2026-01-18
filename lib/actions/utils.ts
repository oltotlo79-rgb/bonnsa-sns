/**
 * Server Actions ユーティリティ
 *
 * このファイルは、Server Actions全体で使用する共通のユーティリティ関数を提供します。
 * エラーハンドリングの統一、認証チェックのラッパー、レスポンス生成などを担当します。
 *
 * ## なぜこのファイルが必要か？
 *
 * ### 1. エラーハンドリングの統一
 * - 各Server Actionで個別にtry-catchを書くと、エラー処理が一貫しない
 * - 共通のラッパー関数で統一されたエラーレスポンスを返す
 *
 * ### 2. ボイラープレートコードの削減
 * - 認証チェック、try-catch、ログ出力など、繰り返し書くコードを削減
 * - 新しいServer Actionを作成する際のコード量を減らす
 *
 * ### 3. 型安全性の向上
 * - ActionResult型により、成功/失敗のレスポンス形式を統一
 * - TypeScriptの型チェックでエラーを早期発見
 *
 * ## 使用例
 * ```typescript
 * // 従来のServer Action（ボイラープレートが多い）
 * export async function oldAction() {
 *   try {
 *     const session = await auth()
 *     if (!session?.user?.id) {
 *       return { error: '認証が必要です' }
 *     }
 *     const result = await someOperation()
 *     return { success: true, data: result }
 *   } catch (error) {
 *     logger.error('Error:', error)
 *     return { error: 'エラーが発生しました' }
 *   }
 * }
 *
 * // 新しい方法（シンプル）
 * export async function newAction() {
 *   const session = await auth()
 *   return authAction(session?.user?.id, async (userId) => {
 *     return someOperation(userId)
 *   })
 * }
 * ```
 *
 * @module lib/actions/utils
 */

// ============================================================
// ディレクティブとインポート
// ============================================================

/**
 * 'use server' ディレクティブ
 *
 * このファイルの関数はServer Actions内で使用されるため、
 * サーバーサイドで実行されることを明示
 */
'use server'

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * - 開発環境: コンソールにエラーログを出力
 * - 本番環境: ログを抑制（将来的には外部サービスに送信）
 */
import logger from '@/lib/logger'

// ============================================================
// 型定義
// ============================================================

/**
 * Server Actionの結果を表す型
 *
 * ## ユニオン型（Union Type）とは？
 * `|` で区切られた複数の型のいずれかを表す
 * この場合、成功パターンか失敗パターンのどちらか
 *
 * ## 判別可能なユニオン（Discriminated Union）
 * `success` プロパティの値（true/false）で型が絞り込まれる
 *
 * ```typescript
 * const result: ActionResult<User> = await someAction()
 *
 * if (result.success) {
 *   // この中では result.data にアクセス可能
 *   console.log(result.data)
 * } else {
 *   // この中では result.error にアクセス可能
 *   console.log(result.error)
 * }
 * ```
 *
 * ## ジェネリック型 T
 * - `ActionResult<User>` → 成功時のdataがUser型
 * - `ActionResult<void>` → 成功時にdataがない（デフォルト）
 * - `ActionResult<{ postId: string }>` → 成功時にpostIdを含むオブジェクト
 */
export type ActionResult<T = void> =
  | { success: true; data?: T }      // 成功パターン
  | { success: false; error: string } // 失敗パターン

// ============================================================
// メイン関数
// ============================================================

/**
 * Server Actionを安全に実行するラッパー関数
 *
 * ## 機能概要
 * - try-catchを自動的に適用
 * - エラー発生時に一貫したレスポンスを返す
 * - エラーログを自動出力
 *
 * ## パラメータ
 * @param action - 実行する非同期関数（実際の処理ロジック）
 * @param errorMessage - エラー時に返すデフォルトメッセージ
 *
 * ## 戻り値
 * @returns Promise<ActionResult<T>> - 統一されたレスポンス形式
 *
 * ## ジェネリック型 <T>
 * 関数呼び出し時に、成功時の戻り値の型を指定できる
 *
 * ## 使用例
 * ```typescript
 * // 基本的な使用
 * export async function createPost(content: string) {
 *   return safeAction(async () => {
 *     const post = await prisma.post.create({ data: { content } })
 *     return post
 *   }, '投稿の作成に失敗しました')
 * }
 *
 * // 戻り値なしの場合
 * export async function deletePost(postId: string) {
 *   return safeAction(async () => {
 *     await prisma.post.delete({ where: { id: postId } })
 *     // 何も返さない = void
 *   })
 * }
 * ```
 *
 * ## エラーハンドリングの詳細
 * 1. actionの実行中にエラーが発生
 * 2. catchブロックでエラーをキャッチ
 * 3. logger.errorでログを出力（開発環境のみ）
 * 4. Errorインスタンスならそのメッセージを使用
 * 5. それ以外ならデフォルトメッセージを使用
 */
export async function safeAction<T>(
  action: () => Promise<T>,
  errorMessage = '処理中にエラーが発生しました'
): Promise<ActionResult<T>> {
  try {
    /**
     * アクションを実行
     *
     * awaitで非同期処理の完了を待機
     * 成功すれば結果をdataとして返す
     */
    const data = await action()
    return { success: true, data }
  } catch (error) {
    /**
     * エラー処理
     *
     * ## logger.error
     * - 開発環境: コンソールにスタックトレース付きで出力
     * - 本番環境: 何も出力しない（将来的には外部サービスへ送信）
     *
     * ## error instanceof Error
     * - errorがErrorクラスのインスタンスかチェック
     * - Errorインスタンスならmessageプロパティを使用
     * - それ以外（文字列や不明な型）ならデフォルトメッセージを使用
     */
    logger.error('Server Action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : errorMessage
    }
  }
}

/**
 * 認証チェック付きServer Actionラッパー
 *
 * ## 機能概要
 * - 認証チェックを自動で行う
 * - 未認証の場合は即座にエラーを返す
 * - 認証済みの場合はsafeActionでラップして実行
 *
 * ## パラメータ
 * @param userId - セッションから取得したユーザーID（undefined可）
 * @param action - userIdを受け取って実行する非同期関数
 * @param errorMessage - エラー時のデフォルトメッセージ
 *
 * ## 戻り値
 * @returns Promise<ActionResult<T>> - 統一されたレスポンス形式
 *
 * ## 使用例
 * ```typescript
 * export async function updateProfile(formData: FormData) {
 *   const session = await auth()
 *
 *   return authAction(
 *     session?.user?.id,
 *     async (userId) => {
 *       // userIdは必ず存在する（型がstring）
 *       const user = await prisma.user.update({
 *         where: { id: userId },
 *         data: {
 *           nickname: formData.get('nickname') as string,
 *         },
 *       })
 *       return user
 *     },
 *     'プロフィールの更新に失敗しました'
 *   )
 * }
 * ```
 *
 * ## なぜuserIdを別引数にするか？
 * - action内でuserIdが必ずstringであることを保証
 * - action内で `userId!` や `userId as string` を書く必要がない
 * - 型安全性が向上
 */
export async function authAction<T>(
  userId: string | undefined,
  action: (userId: string) => Promise<T>,
  errorMessage = '処理中にエラーが発生しました'
): Promise<ActionResult<T>> {
  /**
   * 認証チェック
   *
   * userIdがundefinedの場合、未認証とみなしてエラーを返す
   */
  if (!userId) {
    return { success: false, error: '認証が必要です' }
  }

  /**
   * safeActionでラップして実行
   *
   * userIdを引数としてactionを呼び出す
   * この時点でuserIdはstringであることが保証されている
   */
  return safeAction(() => action(userId), errorMessage)
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * エラーレスポンスを生成
 *
 * ## 用途
 * safeAction/authActionを使わない場合でも、
 * 一貫したエラーレスポンス形式を生成できる
 *
 * ## パラメータ
 * @param message - エラーメッセージ
 *
 * ## 戻り値
 * @returns { error: string } - エラーレスポンスオブジェクト
 *
 * ## 使用例
 * ```typescript
 * if (!isValidInput(input)) {
 *   return errorResponse('入力が不正です')
 * }
 * ```
 *
 * ## 既存コードとの互換性
 * 従来の `{ error: 'message' }` 形式のレスポンスを
 * 生成するために使用。ActionResult型を使わない場合に便利。
 */
export function errorResponse(message: string): { error: string } {
  return { error: message }
}

/**
 * 成功レスポンスを生成
 *
 * ## 用途
 * safeAction/authActionを使わない場合でも、
 * 一貫した成功レスポンス形式を生成できる
 *
 * ## パラメータ
 * @param data - 返すデータ（オプション）
 *
 * ## 戻り値
 * @returns { success: true; data?: T } - 成功レスポンスオブジェクト
 *
 * ## 使用例
 * ```typescript
 * // データなしの成功
 * return successResponse()
 * // { success: true }
 *
 * // データありの成功
 * return successResponse({ postId: '123' })
 * // { success: true, data: { postId: '123' } }
 * ```
 *
 * ## 条件分岐の解説
 * `data !== undefined`
 * - dataが渡された場合: { success: true, data }
 * - dataが渡されなかった場合: { success: true }
 *
 * これにより、不要なdataプロパティを含めないクリーンなレスポンスを生成
 */
export function successResponse<T>(data?: T): { success: true; data?: T } {
  return data !== undefined ? { success: true, data } : { success: true }
}

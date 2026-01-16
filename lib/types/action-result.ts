/**
 * Server Actions用の共通戻り値型定義
 *
 * 使用例:
 * - ActionResult<{ postId: string }> - 成功時にpostIdを返す
 * - ActionResult<void> - 成功時にdataなし
 * - ActionResult<{ posts: Post[], nextCursor?: string }> - 複数データを返す
 */

// 基本的なエラー結果
export interface ErrorResult {
  error: string
  success?: never
}

// 基本的な成功結果
export interface SuccessResult<T = void> {
  success: true
  error?: never
  data?: T
}

// 成功時に直接データを返す場合の結果
export interface DataResult<T> {
  error?: never
  success?: never
  data: T
}

// Server Actionの標準的な戻り値型
// 成功時: { success: true } または { success: true, ...data }
// 失敗時: { error: "エラーメッセージ" }
export type ActionResult<T = void> =
  | ErrorResult
  | (T extends void ? { success: true; error?: never } : { success: true; error?: never } & T)

// データ取得系の戻り値型
// 成功時: { posts: [...], nextCursor: "..." } のようにデータを直接返す
// 失敗時: { error: "エラーメッセージ" }
export type FetchResult<T> = ErrorResult | T

// ページネーション付きリスト結果
export interface PaginatedResult<T> {
  items: T[]
  nextCursor?: string
  hasMore?: boolean
}

// 型ガード関数
export function isErrorResult(result: unknown): result is ErrorResult {
  return result !== null && typeof result === 'object' && 'error' in result && typeof (result as ErrorResult).error === 'string'
}

export function isSuccessResult(result: unknown): result is { success: true } {
  return result !== null && typeof result === 'object' && 'success' in result && (result as { success: boolean }).success === true
}

// 結果を作成するヘルパー関数
export function success(): { success: true }
export function success<T extends Record<string, unknown>>(data: T): { success: true } & T
export function success<T extends Record<string, unknown>>(data?: T) {
  if (data) {
    return { success: true as const, ...data }
  }
  return { success: true as const }
}

export function error(message: string): ErrorResult {
  return { error: message }
}

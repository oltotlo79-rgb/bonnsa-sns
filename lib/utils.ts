/**
 * ユーティリティ関数ファイル
 *
 * このファイルは、アプリケーション全体で使用する汎用的なヘルパー関数を提供します。
 * 主にスタイリング（CSS クラス名）の操作に関する関数が含まれています。
 *
 * ## なぜこのファイルが必要か？
 * - Tailwind CSS を使用する際、条件付きでクラスを適用したいケースが多い
 * - クラス名が重複したり競合したりする問題を防ぐ必要がある
 * - shadcn/ui などのコンポーネントライブラリで必須のユーティリティ
 *
 * @module lib/utils
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * clsx: 条件付きでCSSクラス名を結合するためのライブラリ
 *
 * ## 使用例
 * ```typescript
 * clsx('foo', true && 'bar', false && 'baz')
 * // 結果: 'foo bar'（falseの条件は除外される）
 *
 * clsx({ foo: true, bar: false })
 * // 結果: 'foo'（オブジェクト形式でも指定可能）
 * ```
 *
 * ## ClassValue型とは？
 * clsxが受け入れる値の型定義。以下のものが使用可能：
 * - 文字列: 'class-name'
 * - オブジェクト: { 'class-name': boolean }
 * - 配列: ['class1', 'class2']
 * - null / undefined / false（これらは無視される）
 */
import { clsx, type ClassValue } from "clsx"

/**
 * tailwind-merge: Tailwind CSSのクラス名をインテリジェントにマージするライブラリ
 *
 * ## なぜ必要か？
 * Tailwind CSSでは、同じプロパティに複数のクラスが指定されると競合が起きる。
 * 例: 'p-4 p-2' → どちらが優先されるか不明確
 *
 * ## twMergeの動作
 * ```typescript
 * twMerge('p-4 p-2')
 * // 結果: 'p-2'（後に指定されたものが優先）
 *
 * twMerge('text-red-500 text-blue-500')
 * // 結果: 'text-blue-500'
 *
 * twMerge('px-4 py-2 p-3')
 * // 結果: 'p-3'（pはpx/pyを上書き）
 * ```
 */
import { twMerge } from "tailwind-merge"

// ============================================================
// 関数定義
// ============================================================

/**
 * CSSクラス名を条件付きで結合し、Tailwindの競合を解決するユーティリティ関数
 *
 * ## 関数の役割
 * 1. clsxで条件付きのクラス名を結合
 * 2. twMergeでTailwindクラスの競合を解決
 *
 * ## パラメータの解説
 * @param inputs - 可変長引数（スプレッド構文）
 *   - `...inputs` は任意の数の引数を配列として受け取る
 *   - 各引数はClassValue型（文字列、オブジェクト、配列など）
 *
 * ## 戻り値
 * @returns マージされたクラス名の文字列
 *
 * ## 使用例
 * ```typescript
 * // 基本的な使用
 * cn('text-red-500', 'bg-blue-500')
 * // 結果: 'text-red-500 bg-blue-500'
 *
 * // 条件付きクラス
 * cn('base-class', isActive && 'active-class', isDisabled && 'disabled-class')
 * // isActiveがtrueなら 'base-class active-class'
 *
 * // オブジェクト形式
 * cn('base', { 'text-red-500': hasError, 'text-green-500': !hasError })
 *
 * // Tailwindの競合解決
 * cn('px-4', 'p-6')
 * // 結果: 'p-6'（px-4はp-6に上書きされる）
 *
 * // コンポーネントでの実践的な使用例
 * <button className={cn(
 *   'px-4 py-2 rounded',           // ベーススタイル
 *   variant === 'primary' && 'bg-blue-500 text-white',
 *   variant === 'secondary' && 'bg-gray-200 text-gray-800',
 *   disabled && 'opacity-50 cursor-not-allowed',
 *   className  // 親コンポーネントから渡されるカスタムクラス
 * )}>
 *   {children}
 * </button>
 * ```
 *
 * ## なぜcn関数という名前か？
 * - 「classNames」の略
 * - shadcn/ui の公式推奨の命名規則
 * - 短くて入力しやすい
 *
 * ## 内部の処理フロー
 * 1. `clsx(inputs)` - 引数を展開し、条件に基づいてクラス名を結合
 * 2. `twMerge(...)` - 結合されたクラス名からTailwindの競合を解決
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * @fileoverview ユーザープロフィールページのローディング画面
 *
 * このファイルはNext.js App Routerの規約に従ったローディングUIコンポーネントです。
 * /users/[id]ページおよびその子ルートでデータ取得中に自動的に表示されます。
 *
 * 主な機能:
 * - プロフィールページ読み込み中のフォールバックUI表示
 * - React Suspenseと連携した自動的なローディング状態管理
 * - ユーザーへの視覚的フィードバック提供
 *
 * @route /users/[id] (およびその子ルート)
 */

// 共通ローディング画面コンポーネント（スピナーとメッセージを表示）
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * ユーザーページのローディングコンポーネント
 *
 * Server/Client Componentのどちらでも動作します。
 * Next.jsがSuspenseバウンダリとして自動的にラップし、
 * ページコンポーネントのデータ取得が完了するまでこのコンポーネントを表示します。
 *
 * @returns {JSX.Element} ローディング画面のJSX要素
 */
export default function UserLoading() {
  return <LoadingScreen message="プロフィールを読み込んでいます..." />
}

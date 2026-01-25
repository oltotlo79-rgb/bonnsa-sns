/**
 * @file ログインページ
 * @description ユーザーがメールアドレスとパスワードでログインするためのページコンポーネント
 *
 * 機能概要:
 * - ログイン済みユーザーの自動リダイレクト（フィードページへ）
 * - ログインフォームの表示
 * - 和風デザインのUIレイアウト
 *
 * @remarks
 * このページはServer Componentとして実装されており、
 * サーバーサイドで認証状態をチェックしてからレンダリングを行います。
 * ログインフォーム自体はClient Componentとして別途実装されています。
 */

// ログインフォームコンポーネント（Client Component）
// ユーザー入力の処理とNextAuth.jsによる認証処理を担当
import { LoginForm } from '@/components/auth/LoginForm'

// NextAuth.js認証ヘルパー関数
// サーバーサイドでセッション情報を取得するために使用
import { auth } from '@/lib/auth'

// Next.jsのリダイレクト関数
// サーバーサイドでのページ遷移を実行するために使用
import { redirect } from 'next/navigation'

/**
 * ログインページのメインコンポーネント
 *
 * 処理内容:
 * 1. 現在のセッション情報を取得（認証状態の確認）
 * 2. ログイン済みの場合はフィードページへリダイレクト
 * 3. 未ログインの場合はログインフォームを表示
 *
 * @returns ログインページのJSX要素
 */
export default async function LoginPage() {
  // ログイン済みの場合はフィードにリダイレクト
  // auth()はサーバーサイドでセッション情報を取得する非同期関数
  const session = await auth()
  if (session?.user) {
    // 認証済みユーザーはログインページにアクセスする必要がないため、
    // メインコンテンツであるフィードページへ自動遷移させる
    redirect('/feed')
  }

  return (
    // パディングを設定したコンテナ（レスポンシブ対応）
    <div className="p-6 sm:p-8">
      {/* ページタイトル - 和風フォントと墨色で表示 */}
      <h1 className="font-serif text-xl text-center text-sumi mb-6 tracking-wide">ログイン</h1>

      {/* 装飾用の区切り線 - グラデーションで両端がフェードアウト */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />

      {/* ログインフォームコンポーネント */}
      {/* メールアドレス・パスワード入力と認証処理を担当 */}
      <LoginForm />
    </div>
  )
}

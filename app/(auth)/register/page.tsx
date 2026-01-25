/**
 * @file 新規ユーザー登録ページ
 * @description 新しいユーザーがアカウントを作成するためのページコンポーネント
 *
 * 機能概要:
 * - ユーザー登録フォームの表示
 * - メールアドレス、パスワード、ニックネームの入力
 * - 和風デザインのUIレイアウト
 *
 * @remarks
 * このページは静的なServer Componentとして実装されています。
 * 認証状態のチェックはmiddleware.tsで行われるため、
 * このコンポーネントでは認証チェックを行いません。
 * フォームの入力処理とバリデーションはRegisterFormコンポーネントで実装されています。
 */

// 新規登録フォームコンポーネント（Client Component）
// ユーザー入力の処理、バリデーション、アカウント作成処理を担当
import { RegisterForm } from '@/components/auth/RegisterForm'

/**
 * 新規登録ページのメインコンポーネント
 *
 * 処理内容:
 * - ページタイトルと装飾的な区切り線を表示
 * - RegisterFormコンポーネントをレンダリング
 *
 * @remarks
 * シンプルなラッパーコンポーネントとして機能し、
 * 実際の登録ロジックはRegisterFormに委譲しています。
 *
 * @returns 新規登録ページのJSX要素
 */
export default function RegisterPage() {
  return (
    // パディングを設定したコンテナ（レスポンシブ対応）
    <div className="p-6 sm:p-8">
      {/* ページタイトル - 和風フォントと墨色で表示 */}
      <h1 className="font-serif text-xl text-center text-sumi mb-6 tracking-wide">新規登録</h1>

      {/* 装飾用の区切り線 - グラデーションで両端がフェードアウト */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />

      {/* 新規登録フォームコンポーネント */}
      {/* ニックネーム、メールアドレス、パスワード入力とアカウント作成処理を担当 */}
      <RegisterForm />
    </div>
  )
}

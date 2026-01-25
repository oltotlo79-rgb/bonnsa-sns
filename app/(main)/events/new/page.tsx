/**
 * @file イベント新規登録ページ
 * @description 新しいイベントを登録するためのフォームページ。
 * ログインユーザーがイベントのタイトル、日時、場所、詳細情報などを
 * 入力して新規登録できる。未ログインユーザーはログインページへリダイレクトされる。
 */

// Next.jsのLinkコンポーネント: ページ間ナビゲーション用
import Link from 'next/link'
// Next.jsのリダイレクト関数: 認証チェック後のリダイレクト用
import { redirect } from 'next/navigation'
// NextAuth.jsの認証ヘルパー: 現在のセッション取得
import { auth } from '@/lib/auth'
// イベント登録・編集用フォームコンポーネント
import { EventForm } from '@/components/event/EventForm'

/**
 * ページメタデータ
 * SEO対策としてタイトルを設定
 */
export const metadata = {
  title: 'イベントを登録 - BON-LOG',
}

/**
 * 左矢印アイコンコンポーネント
 * 「戻る」ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

/**
 * イベント新規登録ページコンポーネント
 *
 * このServer Componentは以下の処理を行う:
 * 1. 認証チェック（未ログインならログインページへリダイレクト）
 * 2. 新規作成モードでEventFormコンポーネントをレンダリング
 *
 * イベント登録には認証が必須であり、
 * フォームの実際の登録処理はEventFormコンポーネント内のServer Actionで行われる。
 */
export default async function NewEventPage() {
  // 現在のログインセッションを取得
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 戻るボタン: イベント一覧ページへのナビゲーション */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>イベント一覧に戻る</span>
      </Link>

      {/* フォームカード: 新規登録フォームを含むカードUI */}
      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">イベントを登録</h1>
        {/* EventFormに新規作成モードを渡す */}
        <EventForm mode="create" />
      </div>
    </div>
  )
}

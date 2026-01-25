/**
 * @file ブックマークページコンポーネント
 * @description ユーザーがブックマークした投稿一覧を表示するページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、初期データをサーバーサイドで取得
 *              - カーソルベースのページネーションをサポート
 */

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// Next.js のリダイレクト関数 - 未認証ユーザーをログインページへ誘導
import { redirect } from 'next/navigation'

// ブックマーク済み投稿を取得するServer Action
import { getBookmarkedPosts } from '@/lib/actions/bookmark'

// ブックマーク投稿リストのクライアントコンポーネント - 無限スクロールを実装
import { BookmarkPostList } from './BookmarkPostList'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: 'ブックマーク - BON-LOG',
}

/**
 * ブックマークページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - ブックマーク済み投稿の初期データをサーバーサイドで取得
 * - BookmarkPostListコンポーネントで追加読み込みをサポート
 *
 * @returns ブックマークページのJSX
 */
export default async function BookmarksPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user) {
    redirect('/login')
  }

  // ブックマーク済み投稿を取得（初期表示分）
  const result = await getBookmarkedPosts()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* ページヘッダー */}
        <h1 className="px-4 py-3 font-bold border-b">ブックマーク</h1>

        {/* ブックマーク投稿リスト */}
        {/* 初期データとカーソル、現在のユーザーIDを渡す */}
        <BookmarkPostList
          initialPosts={result.posts || []}
          initialNextCursor={result.nextCursor}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  )
}

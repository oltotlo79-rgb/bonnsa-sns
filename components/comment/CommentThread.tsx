/**
 * コメントスレッドコンポーネント
 *
 * このファイルは、投稿のコメントセクション全体を管理するコンテナコンポーネントです。
 * コメントフォームとコメントリストを組み合わせて、コメント機能を提供します。
 *
 * ## 機能概要
 * - コメント数の表示
 * - ログイン状態に応じたコメントフォームの表示制御
 * - コメントリストの表示
 * - コメント投稿成功時のページ更新
 *
 * ## 使用箇所
 * - 投稿詳細ページ（/posts/[id]）のコメントセクション
 *
 * @module components/comment/CommentThread
 *
 * @example
 * ```tsx
 * <CommentThread
 *   postId="post123"
 *   comments={comments}
 *   nextCursor={nextCursor}
 *   currentUserId={session?.user?.id}
 *   commentCount={42}
 * />
 * ```
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * Next.jsのルーターフック
 * コメント投稿成功時にページを更新（router.refresh()）するために使用
 */
import { useRouter } from 'next/navigation'

/**
 * コメント入力フォームコンポーネント
 * 新規コメントの投稿に使用
 */
import { CommentForm } from './CommentForm'

/**
 * コメントリストコンポーネント
 * コメント一覧の表示と無限スクロールを担当
 */
import { CommentList } from './CommentList'

// ============================================================
// 型定義
// ============================================================

/**
 * コメントの型定義
 *
 * @property id - コメントの一意識別子
 * @property content - コメント本文（テキスト）
 * @property createdAt - コメント作成日時（文字列またはDateオブジェクト）
 * @property parentId - 親コメントID（返信の場合はnull以外、トップレベルはnull）
 * @property user - コメント投稿者の情報
 * @property user.id - ユーザーID
 * @property user.nickname - ユーザーのニックネーム（表示名）
 * @property user.avatarUrl - ユーザーのアバター画像URL（nullの場合はデフォルト表示）
 * @property likeCount - このコメントへのいいね数
 * @property replyCount - このコメントへの返信数（省略可能）
 */
type Comment = {
  id: string
  content: string
  createdAt: string | Date
  parentId: string | null
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  likeCount: number
  replyCount?: number
}

/**
 * CommentThreadコンポーネントのprops型
 *
 * @property postId - コメント対象の投稿ID
 * @property comments - 初期表示するコメントの配列
 * @property nextCursor - ページネーション用の次のカーソル（省略時は追加読み込みなし）
 * @property currentUserId - 現在ログイン中のユーザーID（未ログイン時はundefined）
 * @property commentCount - 投稿に対する総コメント数
 */
type CommentThreadProps = {
  postId: string
  comments: Comment[]
  nextCursor?: string
  currentUserId?: string
  commentCount: number
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * コメントスレッドコンポーネント
 *
 * 投稿のコメントセクション全体を管理するコンテナコンポーネント。
 * ログイン状態に応じてコメントフォームの表示を制御し、
 * コメントリストと組み合わせてコメント機能を提供します。
 *
 * ## コンポーネント構成
 * 1. ヘッダー（コメント数表示）
 * 2. コメントフォーム（ログイン時）/ ログイン案内（未ログイン時）
 * 3. コメントリスト
 *
 * @param postId - 投稿ID
 * @param comments - 初期コメント配列
 * @param nextCursor - ページネーションカーソル
 * @param currentUserId - 現在のユーザーID
 * @param commentCount - 総コメント数
 */
export function CommentThread({
  postId,
  comments,
  nextCursor,
  currentUserId,
  commentCount,
}: CommentThreadProps) {
  /**
   * Next.jsのルーターインスタンス
   * コメント投稿成功時のページ更新に使用
   */
  const router = useRouter()

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * コメント投稿成功時のハンドラ
   *
   * コメントフォームからの送信が成功した後に呼び出され、
   * ページ全体を再読み込みしてコメントリストを更新します。
   *
   * ## 処理内容
   * - router.refresh()でServer Componentを再実行
   * - 最新のコメントデータを取得して表示を更新
   */
  function handleCommentSuccess() {
    router.refresh()
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ヘッダー: コメント数を表示 */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          コメント
          {/* コメントが1件以上ある場合は件数を表示 */}
          {commentCount > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">
              ({commentCount})
            </span>
          )}
        </h3>
      </div>

      {/* コメントフォームまたはログイン案内 */}
      {currentUserId ? (
        // ログイン済み: コメントフォームを表示
        <CommentForm postId={postId} onSuccess={handleCommentSuccess} />
      ) : (
        // 未ログイン: ログイン案内を表示
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            コメントするには
            <a href="/login" className="text-primary hover:underline mx-1">
              ログイン
            </a>
            してください
          </p>
        </div>
      )}

      {/* コメントリスト: 無限スクロール対応 */}
      <CommentList
        postId={postId}
        initialComments={comments}
        initialNextCursor={nextCursor}
        currentUserId={currentUserId}
      />
    </div>
  )
}

/**
 * コメントリストコンポーネント
 *
 * このファイルは、コメント一覧を表示し、無限スクロールによる
 * 追加読み込み機能を提供するコンポーネントです。
 *
 * ## 機能概要
 * - コメント一覧の表示
 * - 「さらに読み込む」ボタンによる追加読み込み
 * - カーソルベースのページネーション
 * - 親コンポーネントからのデータ更新への対応
 * - コメントがない場合の空状態表示
 *
 * ## 使用箇所
 * - CommentThreadコンポーネント内でのコメント一覧表示
 *
 * @module components/comment/CommentList
 *
 * @example
 * ```tsx
 * <CommentList
 *   postId="post123"
 *   initialComments={comments}
 *   initialNextCursor={nextCursor}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: コメント配列とカーソルの状態管理
 * useCallback: 追加読み込み関数のメモ化
 * useEffect: 親コンポーネントからのデータ変更を検知して状態を同期
 */
import { useState, useCallback, useEffect } from 'react'

/**
 * shadcn/ui Buttonコンポーネント
 * 「さらに読み込む」ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * コメントカードコンポーネント
 * 個々のコメントの表示を担当
 */
import { CommentCard } from './CommentCard'

/**
 * Server Actions
 * getComments: 追加コメントの取得
 */
import { getComments } from '@/lib/actions/comment'

// ============================================================
// 型定義
// ============================================================

/**
 * コメントの型定義
 *
 * @property id - コメントの一意識別子
 * @property content - コメント本文
 * @property createdAt - コメント作成日時
 * @property parentId - 親コメントID（トップレベルはnull）
 * @property user - コメント投稿者情報
 * @property user.id - ユーザーID
 * @property user.nickname - ニックネーム
 * @property user.avatarUrl - アバター画像URL
 * @property likeCount - いいね数
 * @property replyCount - 返信数（省略可能）
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
 * CommentListコンポーネントのprops型
 *
 * @property postId - コメント対象の投稿ID
 * @property initialComments - 初期表示するコメント配列
 * @property initialNextCursor - 初期のページネーションカーソル（省略可能）
 * @property currentUserId - 現在ログイン中のユーザーID（省略可能）
 */
type CommentListProps = {
  postId: string
  initialComments: Comment[]
  initialNextCursor?: string
  currentUserId?: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * コメントリストコンポーネント
 *
 * コメント一覧を表示し、カーソルベースのページネーションで
 * 追加読み込み機能を提供するコンポーネント。
 *
 * ## 状態管理
 * - comments: 現在表示中のコメント配列
 * - nextCursor: 次ページ取得用のカーソル（undefinedで終端）
 * - loading: 追加読み込み中フラグ
 *
 * ## 特徴
 * - 親コンポーネントからのinitialComments/initialNextCursor変更に
 *   useEffectで追従（例：新規コメント投稿後のリフレッシュ）
 *
 * @param postId - 投稿ID
 * @param initialComments - 初期コメント配列
 * @param initialNextCursor - 初期カーソル
 * @param currentUserId - 現在のユーザーID
 */
export function CommentList({
  postId,
  initialComments,
  initialNextCursor,
  currentUserId,
}: CommentListProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 現在表示中のコメント配列
   * 初期値はpropsから受け取ったコメント
   * 追加読み込み時に配列の末尾に追加
   */
  const [comments, setComments] = useState<Comment[]>(initialComments)

  /**
   * 次のページを取得するためのカーソル
   * undefinedの場合は全てのコメントを読み込み済み
   */
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor)

  /**
   * 追加コメント読み込み中のローディング状態
   */
  const [loading, setLoading] = useState(false)

  // ------------------------------------------------------------
  // 副作用
  // ------------------------------------------------------------

  /**
   * 親コンポーネントからのデータ更新への対応
   *
   * initialCommentsまたはinitialNextCursorが変更された場合、
   * 内部状態を更新して最新のデータを反映する。
   *
   * ## 使用シナリオ
   * - 新規コメント投稿後にrouter.refresh()でServer Componentが再実行され、
   *   新しいinitialCommentsが渡された場合
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComments(initialComments)
    setNextCursor(initialNextCursor)
  }, [initialComments, initialNextCursor])

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * 追加コメント読み込みハンドラ
   *
   * 「さらに読み込む」ボタンをクリックした際に実行される。
   * useCallbackでメモ化し、依存配列の値が変わらない限り
   * 同じ関数参照を維持する。
   *
   * ## 処理フロー
   * 1. カーソルがない、または読み込み中の場合は早期リターン
   * 2. loading状態をtrueに設定
   * 3. getComments Server Actionでコメントを取得
   * 4. 取得成功時、既存のコメント配列に追加
   * 5. 次のカーソルを更新
   * 6. loading状態をfalseに戻す
   *
   * @returns {Promise<void>}
   */
  const loadMore = useCallback(async () => {
    // カーソルがない（全て読み込み済み）または読み込み中の場合はスキップ
    if (!nextCursor || loading) return

    setLoading(true)
    const result = await getComments(postId, nextCursor)

    if (result.comments) {
      // 既存のコメント配列の末尾に新しいコメントを追加
      setComments(prev => [...prev, ...result.comments as Comment[]])
      // 次のカーソルを更新（undefinedの場合は終端）
      setNextCursor(result.nextCursor)
    }
    setLoading(false)
  }, [postId, nextCursor, loading])

  // ------------------------------------------------------------
  // 空状態の表示
  // ------------------------------------------------------------

  /**
   * コメントがない場合の空状態表示
   */
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        まだコメントはありません。
        <br />
        最初のコメントを投稿しましょう！
      </div>
    )
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* コメント一覧: 各コメントをCommentCardで表示 */}
      {comments.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          postId={postId}
          currentUserId={currentUserId}
        />
      ))}

      {/* 追加読み込みボタン: 次のカーソルがある場合のみ表示 */}
      {nextCursor && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? '読み込み中...' : 'さらに読み込む'}
          </Button>
        </div>
      )}
    </div>
  )
}

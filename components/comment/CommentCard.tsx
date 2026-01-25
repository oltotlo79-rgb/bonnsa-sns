/**
 * コメントカードコンポーネント
 *
 * このファイルは、個々のコメントを表示するカードコンポーネントです。
 * コメントの基本情報、アクションボタン、返信機能を提供します。
 *
 * ## 機能概要
 * - コメント投稿者のアバターと名前表示
 * - コメント本文とメディア（画像・動画）の表示
 * - いいねボタン
 * - 返信ボタンと返信フォーム
 * - 削除ボタン（自分のコメントのみ）
 * - 返信の折りたたみ表示
 * - 再帰的なコメントツリー表示（返信への返信）
 *
 * ## 使用箇所
 * - CommentListコンポーネント内でのコメント表示
 * - 返信コメントの再帰的な表示
 *
 * @module components/comment/CommentCard
 *
 * @example
 * ```tsx
 * <CommentCard
 *   comment={comment}
 *   postId="post123"
 *   currentUserId={session?.user?.id}
 *   isReply={false}
 * />
 * ```
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 * useState: コンポーネント内の状態管理
 */
import { useState } from 'react'

/**
 * Next.jsのルーターフック
 * コメント削除後のページ更新に使用
 */
import { useRouter } from 'next/navigation'

/**
 * Next.js Linkコンポーネント
 * ユーザープロフィールページへのリンクに使用
 */
import Link from 'next/link'

/**
 * Next.js Imageコンポーネント
 * アバター画像とコメント内メディアの最適化表示に使用
 */
import Image from 'next/image'

/**
 * date-fnsの相対時間表示関数
 * 「3時間前」のような表示形式に変換
 */
import { formatDistanceToNow } from 'date-fns'

/**
 * date-fnsの日本語ロケール
 * 相対時間を日本語で表示するために使用
 */
import { ja } from 'date-fns/locale'

/**
 * Lucide Reactアイコン
 * MessageCircle: 返信ボタン用アイコン
 * Trash2: 削除ボタン用アイコン
 * ChevronDown/ChevronUp: 返信の展開/折りたたみアイコン
 */
import { MessageCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * shadcn/ui Buttonコンポーネント
 * アクションボタンの表示に使用
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui AlertDialogコンポーネント群
 * コメント削除確認ダイアログに使用
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/**
 * コメント入力フォームコンポーネント
 * 返信フォームとして使用
 */
import { CommentForm } from './CommentForm'

/**
 * コメントいいねボタンコンポーネント
 * コメントへのいいね機能を提供
 */
import { CommentLikeButton } from './CommentLikeButton'

/**
 * Server Actions
 * deleteComment: コメント削除処理
 * getReplies: 返信コメントの取得
 */
import { deleteComment, getReplies } from '@/lib/actions/comment'

// ============================================================
// 型定義
// ============================================================

/**
 * コメントに添付されたメディアの型定義
 *
 * @property id - メディアの一意識別子
 * @property url - メディアファイルのURL
 * @property type - メディアの種類（'image' | 'video'）
 * @property sortOrder - 表示順序（0から始まる）
 */
type CommentMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

/**
 * コメントの型定義
 *
 * @property id - コメントの一意識別子
 * @property content - コメント本文
 * @property createdAt - コメント作成日時
 * @property parentId - 親コメントID（トップレベルコメントの場合はnull）
 * @property user - コメント投稿者の情報
 * @property user.id - ユーザーID
 * @property user.nickname - ユーザーのニックネーム
 * @property user.avatarUrl - アバター画像URL
 * @property media - 添付メディアの配列（省略可能）
 * @property likeCount - いいね数
 * @property replyCount - 返信数（省略可能）
 * @property isLiked - 現在のユーザーがいいね済みかどうか（省略可能）
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
  media?: CommentMedia[]
  likeCount: number
  replyCount?: number
  isLiked?: boolean
}

/**
 * CommentCardコンポーネントのprops型
 *
 * @property comment - 表示するコメントデータ
 * @property postId - コメントが属する投稿のID
 * @property currentUserId - 現在ログイン中のユーザーID（未ログイン時はundefined）
 * @property isReply - このコメントが返信かどうか（デフォルト: false）
 */
type CommentCardProps = {
  comment: Comment
  postId: string
  currentUserId?: string
  isReply?: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * コメントカードコンポーネント
 *
 * 個々のコメントを表示し、いいね、返信、削除などの
 * インタラクションを提供するカードコンポーネント。
 *
 * ## 状態管理
 * - showReplyForm: 返信フォームの表示状態
 * - showReplies: 返信一覧の表示状態
 * - replies: 読み込んだ返信コメントの配列
 * - loadingReplies: 返信読み込み中フラグ
 * - isDeleting: 削除処理中フラグ
 *
 * @param comment - コメントデータ
 * @param postId - 投稿ID
 * @param currentUserId - 現在のユーザーID
 * @param isReply - 返信コメントかどうか
 */
export function CommentCard({
  comment,
  postId,
  currentUserId,
  isReply = false,
}: CommentCardProps) {
  /**
   * Next.jsのルーターインスタンス
   * コメント削除後のページ更新に使用
   */
  const router = useRouter()

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 返信フォームの表示/非表示状態
   * trueの場合、返信入力フォームを表示
   */
  const [showReplyForm, setShowReplyForm] = useState(false)

  /**
   * 返信コメント一覧の表示/非表示状態
   * trueの場合、返信コメントを展開表示
   */
  const [showReplies, setShowReplies] = useState(false)

  /**
   * 読み込んだ返信コメントの配列
   * 初回は空配列、「返信を表示」クリック時に取得
   */
  const [replies, setReplies] = useState<Comment[]>([])

  /**
   * 返信コメント読み込み中のローディング状態
   */
  const [loadingReplies, setLoadingReplies] = useState(false)

  /**
   * コメント削除処理中の状態
   */
  const [isDeleting, setIsDeleting] = useState(false)

  // ------------------------------------------------------------
  // 計算値
  // ------------------------------------------------------------

  /**
   * 現在のユーザーがこのコメントの投稿者かどうか
   * 削除ボタンの表示制御に使用
   */
  const isOwner = currentUserId === comment.user.id

  /**
   * 相対時間表示（例: "3時間前"）
   * date-fnsを使用して日本語で表示
   */
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * コメント削除ハンドラ
   *
   * 確認ダイアログで「削除」をクリックした際に実行される。
   *
   * ## 処理フロー
   * 1. isDeleting状態をtrueに設定
   * 2. deleteComment Server Actionを実行
   * 3. エラー時はアラート表示
   * 4. 成功時はrouter.refresh()でページ更新
   * 5. isDeleting状態をfalseに戻す
   */
  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteComment(comment.id)
    if (result.error) {
      alert(result.error)
    } else {
      router.refresh()
    }
    setIsDeleting(false)
  }

  /**
   * 返信表示のトグルハンドラ
   *
   * 「N件の返信を表示」ボタンをクリックした際に実行される。
   *
   * ## 処理フロー
   * 1. 既に表示中の場合は非表示に切り替え
   * 2. 返信が未読み込みかつ返信数が1以上の場合、APIから取得
   * 3. 取得成功後、返信を表示状態に切り替え
   */
  async function handleToggleReplies() {
    // 既に表示中の場合は非表示に切り替え
    if (showReplies) {
      setShowReplies(false)
      return
    }

    // 返信が未読み込みかつ返信数が1以上の場合、取得を実行
    if (replies.length === 0 && comment.replyCount !== undefined && comment.replyCount > 0) {
      setLoadingReplies(true)
      const result = await getReplies(comment.id)
      if (result.replies) {
        setReplies(result.replies as Comment[])
      }
      setLoadingReplies(false)
    }

    setShowReplies(true)
  }

  /**
   * 返信投稿成功時のハンドラ
   *
   * 返信フォームからの送信が成功した後に実行される。
   *
   * ## 処理フロー
   * 1. 返信フォームを非表示に
   * 2. 返信一覧を再取得して最新化
   * 3. 返信一覧を表示状態に
   * 4. ページ全体を更新してコメント数を反映
   */
  async function handleReplySuccess() {
    setShowReplyForm(false)
    // 返信を再取得
    const result = await getReplies(comment.id)
    if (result.replies) {
      setReplies(result.replies as Comment[])
      setShowReplies(true)
    }
    // ページ全体を更新してコメント数などを反映
    router.refresh()
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    // 返信コメントの場合は左にインデントと縦線を表示
    <div className={`${isReply ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
      <div className="flex gap-3">
        {/* ユーザーアバター */}
        <Link href={`/users/${comment.user.id}`}>
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
            {comment.user.avatarUrl ? (
              // アバター画像がある場合は表示
              <Image
                src={comment.user.avatarUrl}
                alt={comment.user.nickname}
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              // アバター画像がない場合はニックネームの頭文字を表示
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                {comment.user.nickname[0]}
              </div>
            )}
          </div>
        </Link>

        {/* コメント本文エリア */}
        <div className="flex-1 min-w-0">
          {/* ユーザー名と投稿時間 */}
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/users/${comment.user.id}`}
              className="font-medium hover:underline truncate"
            >
              {comment.user.nickname}
            </Link>
            <span className="text-muted-foreground text-xs">{timeAgo}</span>
          </div>

          {/* コメント本文テキスト */}
          {comment.content && (
            <p className="text-sm mt-1 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* メディア表示（画像・動画） */}
          {comment.media && comment.media.length > 0 && (
            <div className={`mt-2 grid gap-2 ${comment.media.length === 1 ? '' : 'grid-cols-2'}`}>
              {comment.media.map((media) => (
                <div key={media.id} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  {media.type === 'video' ? (
                    // 動画の場合はvideoタグで表示
                    <video
                      src={media.url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    // 画像の場合はImageコンポーネントで表示
                    <Image
                      src={media.url}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* アクションボタン群（いいね、返信、削除） */}
          <div className="flex items-center gap-4 mt-2">
            {/* いいねボタン */}
            {currentUserId ? (
              // ログイン済み: インタラクティブないいねボタンを表示
              <CommentLikeButton
                commentId={comment.id}
                postId={postId}
                initialLiked={comment.isLiked ?? false}
                initialCount={comment.likeCount}
              />
            ) : (
              // 未ログイン: いいね数のみ表示（クリックでログインページへ）
              comment.likeCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  asChild
                >
                  <a href="/login">
                    <span className="text-xs">{comment.likeCount}</span>
                  </a>
                </Button>
              )
            )}

            {/* 返信ボタン（ログイン済みの場合のみ表示） */}
            {currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                <span className="text-xs">返信</span>
              </Button>
            )}

            {/* 削除ボタン（自分のコメントの場合のみ表示） */}
            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                {/* 削除確認ダイアログ */}
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>コメントを削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      このコメントを削除してもよろしいですか？
                      {/* 返信がある場合は警告メッセージを表示 */}
                      {comment.replyCount !== undefined && comment.replyCount > 0 && (
                        <span className="block mt-2 text-destructive">
                          このコメントには{comment.replyCount}件の返信があります。
                          返信もすべて削除されます。
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      削除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* 返信フォーム（表示時のみレンダリング） */}
          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onSuccess={handleReplySuccess}
                onCancel={() => setShowReplyForm(false)}
                placeholder={`@${comment.user.nickname} への返信...`}
                autoFocus
              />
            </div>
          )}

          {/* 返信を表示/非表示ボタン（返信がある場合のみ） */}
          {comment.replyCount !== undefined && comment.replyCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-primary"
              onClick={handleToggleReplies}
              disabled={loadingReplies}
            >
              {loadingReplies ? (
                '読み込み中...'
              ) : showReplies ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  返信を非表示
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  {comment.replyCount}件の返信を表示
                </>
              )}
            </Button>
          )}

          {/* 返信一覧（再帰的にCommentCardを表示） */}
          {showReplies && replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {replies.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

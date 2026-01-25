/**
 * 予約投稿カードコンポーネント
 *
 * このファイルは、予約投稿の情報を表示するカードコンポーネントを提供します。
 * 予約投稿一覧ページで使用されます。
 *
 * ## 機能概要
 * - 予約投稿のステータス表示（予約中、公開済み、失敗、キャンセル）
 * - 予約日時の表示
 * - 投稿内容のプレビュー
 * - 添付メディアのサムネイル表示
 * - ジャンルタグの表示
 * - 編集・削除アクション（予約中のみ）
 * - 公開された投稿へのリンク（公開済みのみ）
 *
 * ## ステータス
 * - pending: 予約中（青）
 * - published: 公開済み（緑）
 * - failed: 公開失敗（赤）
 * - cancelled: キャンセル（グレー）
 *
 * @module components/post/ScheduledPostCard
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React useState Hook
 * 削除処理中の状態管理
 */
import { useState } from 'react'

/**
 * Next.js ナビゲーション
 * 削除後のページリフレッシュに使用
 */
import { useRouter } from 'next/navigation'

/**
 * Next.js Imageコンポーネント
 * メディアサムネイルの最適化
 */
import Image from 'next/image'

/**
 * Next.js Linkコンポーネント
 * 編集ページへの遷移、公開済み投稿へのリンク
 */
import Link from 'next/link'

/**
 * UIコンポーネント
 * shadcn/uiのButton, Card, AlertDialogを使用
 */
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
 * 予約投稿削除用Server Action
 */
import { deleteScheduledPost } from '@/lib/actions/scheduled-post'

/**
 * Lucide Reactアイコン
 *
 * Calendar: 日付表示アイコン
 * Clock: 時間表示アイコン
 * Edit: 編集ボタンアイコン
 * Trash2: 削除ボタンアイコン
 * CheckCircle: 公開済みステータスアイコン
 * XCircle: 失敗ステータスアイコン
 * AlertCircle: キャンセルステータスアイコン
 */
import { Calendar, Clock, Edit, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

// ============================================================
// 型定義
// ============================================================

/**
 * 予約投稿のステータス型
 *
 * - pending: 予約中（まだ公開されていない）
 * - published: 公開済み（正常に投稿された）
 * - failed: 公開失敗（エラーで投稿できなかった）
 * - cancelled: キャンセル（ユーザーによりキャンセルされた）
 */
type ScheduledPostStatus = 'pending' | 'published' | 'failed' | 'cancelled'

/**
 * ScheduledPostCardコンポーネントのProps型
 *
 * @property post - 表示する予約投稿のデータ
 */
type ScheduledPostCardProps = {
  post: {
    /** 予約投稿のID */
    id: string
    /** 投稿テキスト */
    content: string | null
    /** 予約日時 */
    scheduledAt: Date
    /** ステータス */
    status: ScheduledPostStatus
    /** 作成日時 */
    createdAt: Date
    /** 公開された投稿のID（公開済みの場合のみ） */
    publishedPostId: string | null
    /** 添付メディア */
    media: { url: string; type: string }[]
    /** ジャンルタグ */
    genres: { genre: { id: string; name: string } }[]
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 日付をフォーマットする関数
 *
 * @param date - フォーマットするDate
 * @returns 「2024年1月15日（月）」のような文字列
 */
function formatDate(date: Date) {
  const d = new Date(date)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

/**
 * 時間をフォーマットする関数
 *
 * @param date - フォーマットするDate
 * @returns 「10:30」のような文字列
 */
function formatTime(date: Date) {
  const d = new Date(date)
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// 定数
// ============================================================

/**
 * ステータス別の表示設定
 *
 * 各ステータスに対応するラベル、アイコン、CSSクラスを定義
 */
const statusConfig = {
  pending: {
    /** 表示ラベル */
    label: '予約中',
    /** アイコンコンポーネント */
    icon: Clock,
    /** CSSクラス（色） */
    className: 'text-blue-600 bg-blue-50',
  },
  published: {
    label: '公開済み',
    icon: CheckCircle,
    className: 'text-green-600 bg-green-50',
  },
  failed: {
    label: '公開失敗',
    icon: XCircle,
    className: 'text-red-600 bg-red-50',
  },
  cancelled: {
    label: 'キャンセル',
    icon: AlertCircle,
    className: 'text-gray-600 bg-gray-50',
  },
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 予約投稿カードコンポーネント
 *
 * ## 機能
 * - ステータスバッジの表示
 * - 予約日時の表示
 * - 投稿内容のプレビュー（3行で省略）
 * - メディアサムネイルの表示（最大3枚）
 * - ジャンルタグの表示
 * - 予約中の場合: 編集・削除ボタン
 * - 公開済みの場合: 公開された投稿へのリンク
 *
 * ## 削除機能
 * AlertDialogで確認後、Server Actionで削除
 *
 * @param post - 予約投稿のデータ
 *
 * @example
 * ```tsx
 * <ScheduledPostCard
 *   post={{
 *     id: 'scheduled123',
 *     content: '予約投稿のテスト',
 *     scheduledAt: new Date('2024-12-01T10:00:00'),
 *     status: 'pending',
 *     createdAt: new Date(),
 *     publishedPostId: null,
 *     media: [],
 *     genres: [{ genre: { id: 'g1', name: '松柏類' } }],
 *   }}
 * />
 * ```
 */
export function ScheduledPostCard({ post }: ScheduledPostCardProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Next.jsルーター
   * 削除後のページリフレッシュに使用
   */
  const router = useRouter()

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 削除処理中の状態
   */
  const [deleting, setDeleting] = useState(false)

  // ------------------------------------------------------------
  // 計算値
  // ------------------------------------------------------------

  /**
   * 現在のステータスに対応する設定
   */
  const status = statusConfig[post.status]

  /**
   * ステータスアイコンコンポーネント
   */
  const StatusIcon = status.icon

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * 削除実行ハンドラ
   *
   * Server Actionで予約投稿を削除し、ページをリフレッシュ
   */
  async function handleDelete() {
    setDeleting(true)
    await deleteScheduledPost(post.id)
    router.refresh()
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <Card>
      <CardContent className="p-4">
        {/* ステータスと日時 */}
        <div className="flex items-center justify-between mb-3">
          {/* ステータスバッジ */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          {/* 予約日時 */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(post.scheduledAt)}</span>
            <span className="mx-1">|</span>
            <Clock className="w-4 h-4" />
            <span>{formatTime(post.scheduledAt)}</span>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="mb-3">
          {post.content ? (
            /**
             * 投稿本文
             * line-clamp-3で3行に省略
             */
            <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.content}</p>
          ) : (
            /**
             * テキストがない場合
             */
            <p className="text-sm text-muted-foreground italic">（テキストなし）</p>
          )}
        </div>

        {/* メディアプレビュー */}
        {post.media.length > 0 && (
          <div className={`grid gap-2 mb-3 ${post.media.length === 1 ? '' : 'grid-cols-3'}`}>
            {/* 最大3枚まで表示 */}
            {post.media.slice(0, 3).map((media, index) => (
              <div key={index} className="relative aspect-video rounded overflow-hidden bg-muted">
                {media.type === 'video' ? (
                  <video src={media.url} className="w-full h-full object-cover" />
                ) : (
                  <Image src={media.url} alt="" fill className="object-cover" />
                )}
              </div>
            ))}
            {/* 4枚以上ある場合は残り枚数を表示 */}
            {post.media.length > 3 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                +{post.media.length - 3}
              </div>
            )}
          </div>
        )}

        {/* ジャンル */}
        {post.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.genres.map(({ genre }) => (
              <span key={genre.id} className="text-xs bg-secondary px-2 py-0.5 rounded">
                {genre.name}
              </span>
            ))}
          </div>
        )}

        {/* アクション（予約中のみ表示） */}
        {post.status === 'pending' && (
          <div className="flex justify-end gap-2 pt-3 border-t">
            {/* 編集ボタン */}
            <Link href={`/posts/scheduled/${post.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-1" />
                編集
              </Button>
            </Link>
            {/* 削除ボタン（確認ダイアログ付き） */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" />
                  削除
                </Button>
              </AlertDialogTrigger>
              {/* 削除確認ダイアログ */}
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>予約投稿を削除</AlertDialogTitle>
                  <AlertDialogDescription>
                    この予約投稿を削除しますか？この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {deleting ? '削除中...' : '削除する'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* 公開済みの場合は投稿へのリンク */}
        {post.status === 'published' && post.publishedPostId && (
          <div className="pt-3 border-t">
            <Link href={`/posts/${post.publishedPostId}`}>
              <Button variant="link" size="sm" className="p-0 h-auto">
                公開された投稿を見る →
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 投稿カードコンポーネント
 *
 * このファイルは、タイムラインや検索結果で表示される
 * 個別の投稿カードを提供します。
 *
 * ## 機能概要
 * - 投稿の表示（テキスト、画像、動画）
 * - リポスト/引用投稿の表示
 * - いいね・コメント・ブックマーク機能
 * - ハッシュタグのリンク化
 * - 投稿の削除・通報
 *
 * ## コンポーネント構造
 * ```
 * PostCard
 * ├── リポスト表示（リポストの場合）
 * ├── ヘッダー（アバター、ユーザー名、時間、メニュー）
 * ├── 本文（ハッシュタグはリンク化）
 * ├── メディアギャラリー
 * ├── 引用投稿（引用の場合）
 * ├── ジャンルタグ
 * └── アクションボタン（いいね、コメント、リポスト、ブックマーク）
 * ```
 *
 * ## 使用例
 * ```tsx
 * <PostCard
 *   post={post}
 *   currentUserId={session?.user?.id}
 *   initialLiked={post.isLiked}
 *   initialBookmarked={post.isBookmarked}
 * />
 * ```
 *
 * @module components/post/PostCard
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React hooks
 * - useState: コンポーネント内の状態管理
 */
import { useState } from 'react'

/**
 * Next.js 画像最適化コンポーネント
 * 自動的にWebP変換、遅延読み込みなどを行う
 */
import Image from 'next/image'

/**
 * Next.js リンクコンポーネント
 * クライアントサイドナビゲーションを提供
 */
import Link from 'next/link'

/**
 * Next.js ルーター
 * プログラムによるページ遷移に使用
 */
import { useRouter } from 'next/navigation'

/**
 * date-fns: 日付操作ライブラリ
 * formatDistanceToNow: 「3時間前」のような相対時間表示を生成
 */
import { formatDistanceToNow } from 'date-fns'

/**
 * date-fns 日本語ロケール
 * 「3 hours ago」→「3時間前」のように日本語化
 */
import { ja } from 'date-fns/locale'

/**
 * UIコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * 投稿関連の子コンポーネント
 */
import { ImageGallery } from './ImageGallery'
import { QuotedPost } from './QuotedPost'
import { DeletePostButton } from './DeletePostButton'
import { LikeButton } from './LikeButton'
import { BookmarkButton } from './BookmarkButton'
import { ReportButton } from '@/components/report/ReportButton'

// ============================================================
// 型定義
// ============================================================

/**
 * 投稿ユーザーの型
 *
 * 投稿者の基本情報を表す。
 * 完全なUser型ではなく、表示に必要な最小限のフィールドのみ。
 */
type PostUser = {
  /** ユーザーID */
  id: string
  /** 表示名（ニックネーム） */
  nickname: string
  /** アバター画像URL（未設定の場合null） */
  avatarUrl: string | null
}

/**
 * 投稿メディアの型
 *
 * 投稿に添付された画像や動画の情報。
 */
type PostMedia = {
  /** メディアID */
  id: string
  /** メディアのURL */
  url: string
  /** メディアタイプ（'image' または 'video'） */
  type: string
  /** 表示順序（0から開始） */
  sortOrder: number
}

/**
 * 投稿ジャンルの型
 *
 * 投稿に付けられたジャンルタグ。
 */
type PostGenre = {
  /** ジャンルID */
  id: string
  /** ジャンル名 */
  name: string
  /** カテゴリ（'shouhin', 'dougu' など） */
  category: string
}

/**
 * 引用投稿の型
 *
 * 引用された元の投稿の情報。
 */
type QuotePost = {
  /** 投稿ID */
  id: string
  /** 投稿本文 */
  content: string | null
  /** 作成日時 */
  createdAt: string | Date
  /** 投稿者情報 */
  user: PostUser
}

/**
 * 投稿の完全な型
 *
 * PostCardで表示する投稿のすべての情報を含む。
 */
type Post = {
  /** 投稿ID */
  id: string
  /** 投稿本文 */
  content: string | null
  /** 作成日時 */
  createdAt: string | Date
  /** 投稿者情報 */
  user: PostUser
  /** 添付メディア */
  media: PostMedia[]
  /** ジャンルタグ */
  genres: PostGenre[]
  /** いいね数 */
  likeCount: number
  /** コメント数 */
  commentCount: number
  /** 引用元投稿（引用投稿の場合） */
  quotePost?: QuotePost | null
  /** リポスト元投稿（リポストの場合） */
  repostPost?: (QuotePost & { media: PostMedia[] }) | null
  /** 現在のユーザーがいいね済みか */
  isLiked?: boolean
  /** 現在のユーザーがブックマーク済みか */
  isBookmarked?: boolean
}

/**
 * PostCardコンポーネントのProps
 */
type PostCardProps = {
  /** 表示する投稿 */
  post: Post
  /** 現在ログイン中のユーザーID（未ログインの場合undefined） */
  currentUserId?: string
  /** 初期状態でいいね済みか */
  initialLiked?: boolean
  /** 初期状態でブックマーク済みか */
  initialBookmarked?: boolean
  /** クリックによるナビゲーションを無効化（モーダル内などで使用） */
  disableNavigation?: boolean
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * ハートアイコン
 *
 * いいねボタンに使用。filled=trueで塗りつぶし表示。
 */
function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

/**
 * メッセージアイコン
 *
 * コメント数の表示に使用。
 */
function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

/**
 * リピートアイコン
 *
 * リポスト機能に使用。
 */
function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

/**
 * ブックマークアイコン
 *
 * ブックマークボタンに使用。filled=trueで塗りつぶし表示。
 */
function BookmarkIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  )
}

/**
 * 三点リーダーアイコン（横）
 *
 * メニューボタンに使用。
 */
function MoreHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  )
}

// ============================================================
// 定数
// ============================================================

/**
 * 本文の省略表示閾値
 *
 * 本文がこの文字数を超える場合、「続きを表示」リンクを表示して省略する。
 */
const CONTENT_TRUNCATE_LENGTH = 150

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 投稿カードコンポーネント
 *
 * ## 機能
 * - 投稿の表示（ユーザー情報、本文、メディア、ジャンル）
 * - いいね・コメント・ブックマーク機能
 * - リポスト・引用投稿の表示
 * - 投稿削除・通報メニュー
 *
 * ## 状態管理
 * - showMenu: ドロップダウンメニューの表示状態
 * - isExpanded: 長い本文を展開しているかどうか
 *
 * ## イベント処理
 * - カード全体のクリック: 投稿詳細ページへ遷移
 * - リンク/ボタンのクリック: e.stopPropagation()でバブリング停止
 */
export function PostCard({ post, currentUserId, initialLiked, initialBookmarked, disableNavigation = false }: PostCardProps) {
  // ------------------------------------------------------------
  // フックとステート
  // ------------------------------------------------------------

  /** ルーター: プログラムによるページ遷移に使用 */
  const router = useRouter()

  /** ドロップダウンメニューの表示状態 */
  const [showMenu, setShowMenu] = useState(false)

  /** 長い本文を展開しているかどうか */
  const [isExpanded, setIsExpanded] = useState(false)

  // ------------------------------------------------------------
  // 算出プロパティ
  // ------------------------------------------------------------

  /** 現在のユーザーが投稿の所有者かどうか */
  const isOwner = currentUserId === post.user.id

  /** いいね数（nullの場合は0） */
  const likesCount = post.likeCount ?? 0

  /** コメント数（nullの場合は0） */
  const commentsCount = post.commentCount ?? 0

  /** いいね済みかどうか（初期値 → props → デフォルトの優先順） */
  const isLiked = initialLiked ?? post.isLiked ?? false

  /** ブックマーク済みかどうか */
  const isBookmarked = initialBookmarked ?? post.isBookmarked ?? false

  /**
   * 表示する投稿
   *
   * リポストの場合は元の投稿を表示し、
   * 通常の投稿の場合はそのまま表示する。
   */
  const displayPost = post.repostPost || post

  /** リポストかどうか */
  const isRepost = !!post.repostPost

  /**
   * 相対時間表示
   *
   * formatDistanceToNow: 現在時刻からの経過時間を計算
   * addSuffix: 「前」を付加（「3時間前」のように）
   * locale: ja を指定して日本語化
   */
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  // ------------------------------------------------------------
  // ヘルパー関数
  // ------------------------------------------------------------

  /**
   * ハッシュタグをリンク化する関数
   *
   * ## 処理内容
   * 1. 正規表現でハッシュタグを分割
   * 2. ハッシュタグ部分はLinkコンポーネントに変換
   * 3. それ以外はそのままテキストとして表示
   *
   * ## 正規表現の解説
   * /(#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g
   * - #: ハッシュ記号
   * - \w: 英数字とアンダースコア
   * - \u3040-\u309F: ひらがな
   * - \u30A0-\u30FF: カタカナ
   * - \u4E00-\u9FAF: 漢字
   *
   * @param content - 本文
   * @returns React要素の配列
   */
  function renderContent(content: string) {
    const parts = content.split(/(#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <Link
            key={i}
            href={`/search?q=${encodeURIComponent(part)}`}
            className="text-bonsai-green hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </Link>
        )
      }
      return part
    })
  }

  return (
    <article
      className={`bg-tonoko/80 backdrop-blur-sm border-b border-kitsune/20 p-4 hover:bg-kitsune/10 transition-all duration-200 ${!disableNavigation ? 'cursor-pointer' : ''}`}
      onClick={!disableNavigation ? () => router.push(`/posts/${displayPost.id}`) : undefined}
    >
      {/* リポスト表示 */}
      {isRepost && (
        <div className="flex items-center gap-2 text-xs text-sumi/50 mb-2">
          <RepeatIcon className="w-3 h-3" />
          <Link
            href={`/users/${post.user.id}`}
            className="hover:text-kitsune"
            onClick={(e) => e.stopPropagation()}
          >
            {post.user.nickname}
          </Link>
          がリポスト
        </div>
      )}

      {/* ヘッダー: アバター + ユーザー名 + 時間 */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={`/users/${displayPost.user.id}`}
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-10 bg-muted overflow-hidden border-2 border-kitsune/30 hover:border-kitsune/50 transition-all duration-200">
            {displayPost.user.avatarUrl ? (
              <Image
                src={displayPost.user.avatarUrl}
                alt={displayPost.user.nickname}
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sumi/60 font-serif bg-gradient-to-br from-muted to-secondary">
                {displayPost.user.nickname.charAt(0)}
              </div>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link
            href={`/users/${displayPost.user.id}`}
            className="font-medium text-sumi hover:text-kitsune truncate transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {displayPost.user.nickname}
          </Link>
          <span className="text-sm text-sumi/40 flex-shrink-0">{timeAgo}</span>
        </div>

        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <MoreHorizontalIcon className="w-4 h-4 text-muted-foreground" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border rounded-lg shadow-lg py-1 min-w-[140px]">
                {isOwner && !isRepost && (
                  <DeletePostButton postId={post.id} variant="menu" onDeleted={() => setShowMenu(false)} />
                )}
                {currentUserId && !isOwner && (
                  <ReportButton
                    targetType="post"
                    targetId={displayPost.id}
                    variant="menu"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 本文 */}
      {displayPost.content && (
        <div className="mb-3">
          <p className="whitespace-pre-wrap break-words">
            {displayPost.content.length > CONTENT_TRUNCATE_LENGTH && !isExpanded
              ? renderContent(displayPost.content.slice(0, CONTENT_TRUNCATE_LENGTH) + '...')
              : renderContent(displayPost.content)}
          </p>
          {displayPost.content.length > CONTENT_TRUNCATE_LENGTH && !isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(true)
              }}
              className="text-primary hover:underline text-sm mt-1"
            >
              続きを表示
            </button>
          )}
        </div>
      )}

      {/* メディア（全幅表示） */}
      {'media' in displayPost && displayPost.media && displayPost.media.length > 0 && (
        <div className="mb-3 -mx-4">
          <ImageGallery
            images={displayPost.media}
            onMediaClick={!disableNavigation ? () => router.push(`/posts/${displayPost.id}`) : undefined}
          />
        </div>
      )}

      {/* 引用投稿 */}
      {post.quotePost && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <QuotedPost post={post.quotePost} />
        </div>
      )}

      {/* ジャンルタグ */}
      {post.genres && post.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.genres.map((genre) => (
            <Link
              key={genre.id}
              href={`/search?genre=${genre.id}`}
              className="inline-flex items-center px-2.5 py-1 text-xs bg-kitsune/10 border border-kitsune/20 text-kitsune hover:bg-kitsune/20 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {genre.name}
            </Link>
          ))}
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center gap-4 -ml-2" onClick={(e) => e.stopPropagation()}>
        {currentUserId ? (
          <LikeButton
            postId={displayPost.id}
            initialLiked={isLiked}
            initialCount={likesCount}
          />
        ) : (
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" asChild>
            <Link href="/login">
              <HeartIcon className="w-4 h-4" />
              <span className="text-xs">{likesCount > 0 && likesCount}</span>
            </Link>
          </Button>
        )}

        <Link href={`/posts/${displayPost.id}`}>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-blue-500 gap-1">
            <MessageCircleIcon className="w-4 h-4" />
            <span className="text-xs">{commentsCount > 0 && commentsCount}</span>
          </Button>
        </Link>

        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-green-500">
          <RepeatIcon className="w-4 h-4" />
        </Button>

        {currentUserId ? (
          <BookmarkButton
            postId={displayPost.id}
            initialBookmarked={isBookmarked}
          />
        ) : (
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link href="/login">
              <BookmarkIcon className="w-4 h-4" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}

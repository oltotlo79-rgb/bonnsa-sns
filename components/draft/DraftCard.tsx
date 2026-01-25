/**
 * @file DraftCard.tsx
 * @description 下書きカードコンポーネント
 *
 * このコンポーネントは、保存された下書き投稿を一覧表示するためのカードUIを提供します。
 * 下書きの内容プレビュー、メディアサムネイル、ジャンルタグを表示し、
 * 編集、削除、投稿のアクションが可能です。
 *
 * @features
 * - 下書き内容のプレビュー表示（3行まで）
 * - メディア（画像/動画）のサムネイル表示
 * - ジャンルタグの表示
 * - 最終更新日時の表示
 * - 編集ページへのリンク
 * - 削除機能（確認ダイアログ付き）
 * - 投稿機能（下書きを公開投稿に変換）
 *
 * @usage
 * ```tsx
 * <DraftCard draft={draftData} />
 * ```
 */
'use client'

// ============================================================
// インポート
// ============================================================

/**
 * useState - コンポーネントの状態管理フック
 * 削除中、投稿中などのローディング状態を管理
 */
import { useState } from 'react'

/**
 * useRouter - Next.jsのルーターフック
 * ページ遷移とデータ再検証に使用
 */
import { useRouter } from 'next/navigation'

/**
 * Image - Next.jsの最適化画像コンポーネント
 * メディアサムネイルの表示に使用
 */
import Image from 'next/image'

/**
 * Link - Next.jsのリンクコンポーネント
 * 編集ページへのナビゲーションに使用
 */
import Link from 'next/link'

/**
 * deleteDraft - 下書き削除のServer Action
 * publishDraft - 下書きを投稿に変換するServer Action
 */
import { deleteDraft, publishDraft } from '@/lib/actions/draft'

// ============================================================
// 型定義
// ============================================================

/**
 * 下書きに添付されたメディアの型定義
 */
type DraftMedia = {
  /** メディアの一意識別子 */
  id: string
  /** メディアファイルのURL */
  url: string
  /** メディアの種別（'image' | 'video'） */
  type: string
}

/**
 * 下書きに紐づくジャンル情報の型定義
 */
type DraftGenre = {
  /** ジャンルID（中間テーブルのキー） */
  genreId: string
  /** ジャンルの詳細情報 */
  genre: {
    /** ジャンルの一意識別子 */
    id: string
    /** ジャンル名（表示用） */
    name: string
  }
}

/**
 * 下書きデータの型定義
 */
type Draft = {
  /** 下書きの一意識別子 */
  id: string
  /** 投稿本文（null許容） */
  content: string | null
  /** 作成日時 */
  createdAt: Date
  /** 最終更新日時 */
  updatedAt: Date
  /** 添付メディアの配列 */
  media: DraftMedia[]
  /** 紐づくジャンルの配列 */
  genres: DraftGenre[]
}

/**
 * DraftCardコンポーネントのプロパティ定義
 */
interface DraftCardProps {
  /** 表示する下書きデータ */
  draft: Draft
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * ゴミ箱アイコンコンポーネント
 * 削除ボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* ゴミ箱の蓋 */}
      <path d="M3 6h18" />
      {/* ゴミ箱の本体 */}
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      {/* ゴミ箱の取っ手部分 */}
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

/**
 * 鉛筆アイコンコンポーネント
 * 編集ボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 鉛筆の本体と先端 */}
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      {/* 鉛筆の編集ライン */}
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * 送信アイコンコンポーネント
 * 投稿ボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function SendIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 紙飛行機の本体 */}
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      {/* 紙飛行機の軌跡 */}
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  )
}

/**
 * 画像アイコンコンポーネント
 * 動画サムネイルのプレースホルダーに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 画像フレーム */}
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      {/* 太陽（画像の一般的な要素） */}
      <circle cx="9" cy="9" r="2" />
      {/* 山の風景線 */}
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 下書きカードコンポーネント
 *
 * 保存された下書き投稿を表示するカード形式のUI。
 * プレビュー表示、各種アクションボタンを提供。
 *
 * @param props - コンポーネントプロパティ
 * @returns 下書きカードのReact要素
 */
export function DraftCard({ draft }: DraftCardProps) {
  // ============================================================
  // フックの初期化
  // ============================================================

  /**
   * Next.jsルーターインスタンス
   * ページ遷移とデータ再検証に使用
   */
  const router = useRouter()

  // ============================================================
  // ステート管理
  // ============================================================

  /**
   * 削除処理中の状態を管理
   * true: 削除APIを呼び出し中
   */
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * 投稿処理中の状態を管理
   * true: 投稿APIを呼び出し中
   */
  const [isPublishing, setIsPublishing] = useState(false)

  // ============================================================
  // イベントハンドラ
  // ============================================================

  /**
   * 削除ボタンクリック時のハンドラ
   *
   * 確認ダイアログを表示し、OKなら下書きを削除。
   * 成功時はページをリフレッシュしてリストを更新。
   */
  const handleDelete = async () => {
    // 削除確認ダイアログ
    if (!confirm('この下書きを削除しますか？')) return

    setIsDeleting(true)
    try {
      // Server Actionで削除実行
      const result = await deleteDraft(draft.id)
      if (result.error) {
        // エラー時はアラート表示
        alert(result.error)
      } else {
        // 成功時はリストを更新
        router.refresh()
      }
    } catch {
      // 予期せぬエラー
      alert('削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  /**
   * 投稿ボタンクリック時のハンドラ
   *
   * 確認ダイアログを表示し、OKなら下書きを公開投稿に変換。
   * 成功時はフィードページに遷移。
   */
  const handlePublish = async () => {
    // 投稿確認ダイアログ
    if (!confirm('この下書きを投稿しますか？')) return

    setIsPublishing(true)
    try {
      // Server Actionで投稿実行
      const result = await publishDraft(draft.id)
      if (result.error) {
        // エラー時はアラート表示
        alert(result.error)
      } else {
        // 成功時はフィードページに遷移
        router.push('/feed')
        router.refresh()
      }
    } catch {
      // 予期せぬエラー
      alert('投稿に失敗しました')
    } finally {
      setIsPublishing(false)
    }
  }

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-4">
        {/* 更新日時 - 最終編集のタイムスタンプを表示 */}
        <p className="text-xs text-muted-foreground mb-2">
          最終更新: {new Date(draft.updatedAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {/* 本文プレビュー - 最大3行まで表示（line-clamp-3） */}
        {draft.content ? (
          <p className="whitespace-pre-wrap line-clamp-3">{draft.content}</p>
        ) : (
          // 本文がない場合のプレースホルダー
          <p className="text-muted-foreground italic">テキストなし</p>
        )}

        {/* 画像/動画プレビュー - メディアがある場合のみ表示 */}
        {draft.media.length > 0 && (
          <div className="mt-3 flex gap-2">
            {/* 最大4つまでサムネイル表示 */}
            {draft.media.slice(0, 4).map((media) => (
              <div key={media.id} className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                {media.type === 'video' ? (
                  // 動画の場合はアイコンプレースホルダー
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                ) : (
                  // 画像の場合はサムネイル表示
                  <Image
                    src={media.url}
                    alt=""
                    fill
                    className="object-cover"
                  />
                )}
              </div>
            ))}
            {/* 5つ以上のメディアがある場合、残数を表示 */}
            {draft.media.length > 4 && (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
                +{draft.media.length - 4}
              </div>
            )}
          </div>
        )}

        {/* ジャンルタグ - 紐づくジャンルをタグ形式で表示 */}
        {draft.genres.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {draft.genres.map((g) => (
              <span
                key={g.genreId}
                className="px-2 py-1 text-xs bg-muted rounded-full"
              >
                {g.genre.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* アクションボタン - 編集、削除、投稿 */}
      <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
        {/* 左側: 編集・削除ボタン */}
        <div className="flex gap-2">
          {/* 編集ボタン - 編集ページへのリンク */}
          <Link
            href={`/drafts/${draft.id}/edit`}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            編集
          </Link>
          {/* 削除ボタン */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="w-4 h-4" />
            {isDeleting ? '削除中...' : '削除'}
          </button>
        </div>

        {/* 右側: 投稿ボタン */}
        <button
          onClick={handlePublish}
          disabled={isPublishing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <SendIcon className="w-4 h-4" />
          {isPublishing ? '投稿中...' : '投稿する'}
        </button>
      </div>
    </div>
  )
}

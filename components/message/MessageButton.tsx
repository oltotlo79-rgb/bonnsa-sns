/**
 * メッセージ送信ボタンコンポーネント
 *
 * このファイルは、ユーザープロフィールページなどで表示される
 * ダイレクトメッセージ開始ボタンを提供します。
 * クリックすると対象ユーザーとの会話画面に遷移します。
 *
 * ## 機能概要
 * - 対象ユーザーとの会話を取得または新規作成
 * - 会話画面への自動遷移
 * - ブロック中のユーザーへのメッセージ送信防止
 * - 処理中のローディング表示
 * - エラーメッセージの表示
 *
 * ## 使用例
 * ```tsx
 * // 基本的な使用方法
 * <MessageButton userId="user-123" />
 *
 * // ブロック中のユーザー（ボタン無効化）
 * <MessageButton userId="user-456" isBlocked={true} />
 * ```
 *
 * @module components/message/MessageButton
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 * useState: エラーメッセージの状態管理
 * useTransition: 非同期処理の状態管理（isPendingフラグ）
 */
import { useState, useTransition } from 'react'

/**
 * Next.js ルーターフック
 * 会話画面への遷移に使用
 */
import { useRouter } from 'next/navigation'

/**
 * 会話取得/作成用Server Action
 * 既存の会話があればそれを返し、なければ新規作成する
 */
import { getOrCreateConversation } from '@/lib/actions/message'

/**
 * shadcn/ui ボタンコンポーネント
 * 統一されたスタイルのボタンを提供
 */
import { Button } from '@/components/ui/button'

// ============================================================
// 内部コンポーネント
// ============================================================

/**
 * メッセージアイコン（吹き出し型）
 *
 * SVGで描画されるメッセージアイコンコンポーネント。
 * Lucide Iconsの "message-square" を参考にした実装。
 *
 * @param className - 追加のCSSクラス（サイズ調整などに使用）
 */
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 吹き出し本体のパス */}
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

/**
 * MessageButtonコンポーネントのprops型定義
 *
 * @property userId - メッセージを送る相手のユーザーID
 * @property isBlocked - 相手がブロック中かどうか（trueの場合ボタン無効化）
 */
interface MessageButtonProps {
  userId: string
  isBlocked?: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * メッセージ送信ボタンコンポーネント
 *
 * ユーザープロフィールページに表示され、クリックすると
 * そのユーザーとのダイレクトメッセージ画面に遷移します。
 *
 * ## 動作フロー
 * 1. ボタンクリック
 * 2. getOrCreateConversation Server Actionを呼び出し
 * 3. 既存の会話があればそのID、なければ新規作成したIDを取得
 * 4. /messages/{conversationId} に遷移
 *
 * @param userId - メッセージ相手のユーザーID
 * @param isBlocked - ブロック状態（デフォルト: false）
 *
 * @returns メッセージボタンのJSX
 */
export function MessageButton({ userId, isBlocked = false }: MessageButtonProps) {
  /** ページ遷移用のルーター */
  const router = useRouter()

  /**
   * 非同期処理の状態管理
   * isPending: 処理中フラグ（trueの間はボタン無効化）
   * startTransition: 非同期処理を開始する関数
   */
  const [isPending, startTransition] = useTransition()

  /**
   * エラーメッセージの状態
   * null: エラーなし
   * string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ボタンクリック時のハンドラ
   *
   * 会話を取得または作成し、会話画面に遷移します。
   * ブロック中の場合は何もしません。
   */
  const handleClick = () => {
    // ブロック中の場合は処理しない
    if (isBlocked) return

    // エラー状態をクリア
    setError(null)

    // useTransitionで非同期処理を実行
    startTransition(async () => {
      // Server Actionで会話を取得/作成
      const result = await getOrCreateConversation(userId)

      // エラーが発生した場合
      if (result.error) {
        setError(result.error)
        return
      }

      // 成功した場合は会話画面に遷移
      if (result.conversationId) {
        router.push(`/messages/${result.conversationId}`)
      }
    })
  }

  return (
    <>
      {/* メッセージボタン */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleClick}
        disabled={isPending || isBlocked}
        title={isBlocked ? 'メッセージを送れません' : 'メッセージを送る'}
      >
        <MessageSquareIcon className="w-4 h-4" />
      </Button>

      {/* エラーメッセージ表示 */}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </>
  )
}

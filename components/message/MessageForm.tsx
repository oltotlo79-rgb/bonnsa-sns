/**
 * メッセージ送信フォームコンポーネント
 *
 * このファイルは、ダイレクトメッセージ画面の下部に表示される
 * メッセージ入力・送信フォームを提供します。
 *
 * ## 機能概要
 * - テキストエリアでのメッセージ入力（複数行対応）
 * - 入力内容に応じた自動高さ調整
 * - Ctrl+Enter / Cmd+Enter でのショートカット送信
 * - 文字数カウント表示（最大1000文字）
 * - 送信中のローディング状態表示
 * - エラーメッセージ表示
 *
 * ## 使用例
 * ```tsx
 * <MessageForm conversationId="conv-123" />
 * ```
 *
 * @module components/message/MessageForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 * useState: 入力内容・エラーメッセージの状態管理
 * useTransition: 送信処理の状態管理
 * useRef: テキストエリア要素への参照
 * useEffect: テキストエリアの高さ自動調整
 */
import { useState, useTransition, useRef, useEffect } from 'react'

/**
 * Next.js ルーターフック
 * メッセージ送信後のページ更新に使用
 */
import { useRouter } from 'next/navigation'

/**
 * メッセージ送信用Server Action
 */
import { sendMessage } from '@/lib/actions/message'

// ============================================================
// 内部コンポーネント
// ============================================================

/**
 * 送信アイコン（紙飛行機型）
 *
 * SVGで描画される送信アイコンコンポーネント。
 * Lucide Iconsの "send" を参考にした実装。
 *
 * @param className - 追加のCSSクラス（サイズ調整などに使用）
 */
function SendIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 紙飛行機の外形 */}
      <path d="m22 2-7 20-4-9-9-4Z"/>
      {/* 紙飛行機の折り目線 */}
      <path d="M22 2 11 13"/>
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

/**
 * MessageFormコンポーネントのprops型定義
 *
 * @property conversationId - メッセージを送信する会話のID
 */
interface MessageFormProps {
  conversationId: string
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * メッセージ送信フォームコンポーネント
 *
 * 会話画面の下部に固定表示され、メッセージの入力と送信を行います。
 *
 * ## 動作フロー
 * 1. テキストエリアにメッセージを入力
 * 2. 送信ボタンクリック または Ctrl+Enter で送信
 * 3. Server Actionでメッセージを保存
 * 4. 成功時：入力欄クリア、画面更新
 * 5. 失敗時：エラーメッセージ表示
 *
 * @param conversationId - 会話ID
 *
 * @returns メッセージ入力フォームのJSX
 */
export function MessageForm({ conversationId }: MessageFormProps) {
  /** ページ更新用のルーター */
  const router = useRouter()

  /**
   * メッセージ入力内容の状態
   * 空文字で初期化、入力に応じて更新
   */
  const [content, setContent] = useState('')

  /**
   * エラーメッセージの状態
   * null: エラーなし
   * string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 非同期処理の状態管理
   * isPending: 送信処理中フラグ
   * startTransition: 送信処理を開始する関数
   */
  const [isPending, startTransition] = useTransition()

  /**
   * テキストエリア要素への参照
   * 高さの自動調整に使用
   */
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * テキストエリアの高さを入力内容に応じて自動調整
   *
   * 依存配列: [content]
   * - 入力内容が変わるたびに高さを再計算
   * - 最小高さ: 1行分（auto）
   * - 最大高さ: 120px（約4-5行分）
   */
  useEffect(() => {
    if (textareaRef.current) {
      // 一度高さをautoにリセットしてscrollHeightを正確に取得
      textareaRef.current.style.height = 'auto'
      // scrollHeightと最大高さ120pxの小さい方を設定
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  /**
   * フォーム送信ハンドラ
   *
   * メッセージをServer Actionで送信し、成功時は入力欄をクリアします。
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent) => {
    // デフォルトのフォーム送信を防止
    e.preventDefault()

    // 空白のみ or 送信中の場合は処理しない
    if (!content.trim() || isPending) return

    // エラー状態をクリア
    setError(null)

    // useTransitionで非同期処理を実行
    startTransition(async () => {
      // Server Actionでメッセージを送信
      const result = await sendMessage(conversationId, content.trim())

      // エラーが発生した場合
      if (result.error) {
        setError(result.error)
        return
      }

      // 成功した場合は入力欄をクリアして画面を更新
      setContent('')
      router.refresh()
    })
  }

  /**
   * キーボードイベントハンドラ
   *
   * Ctrl+Enter（Windows）または Cmd+Enter（Mac）で送信します。
   * 通常のEnterキーは改行として動作します。
   *
   * @param e - キーボードイベント
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter または Cmd+Enter で送信
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit(e)
    }
    // Enterのみは改行（デフォルト動作のまま）
  }

  return (
    <div className="border-t p-4">
      {/* エラーメッセージ表示エリア */}
      {error && (
        <div className="mb-2 p-2 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg">
          {error}
        </div>
      )}

      {/* メッセージ入力フォーム */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        {/* テキストエリアコンテナ */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            maxLength={1000}
            rows={1}
            className="w-full px-4 py-2 border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isPending}
          />
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={!content.trim() || isPending}
          className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>

      {/* 文字数カウントとショートカットヒント */}
      <p className="text-xs text-muted-foreground mt-2">
        {content.length}/1000文字 | Ctrl+Enterで送信
      </p>
    </div>
  )
}

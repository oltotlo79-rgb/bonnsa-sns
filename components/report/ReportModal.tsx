/**
 * @file ReportModal.tsx
 * @description 通報フォームモーダルコンポーネント
 *
 * このコンポーネントは、ユーザーが不適切なコンテンツを通報するための
 * モーダルダイアログを提供します。通報理由の選択と詳細説明の入力が可能です。
 *
 * @features
 * - 通報理由のラジオボタン選択
 * - 詳細説明テキストエリア（任意、最大500文字）
 * - 送信中のローディング表示
 * - 送信成功時の完了メッセージ
 * - エラーハンドリング
 * - body要素へのPortalレンダリング（z-index問題回避）
 * - スクロールロック機能
 *
 * @usage
 * ```tsx
 * <ReportModal
 *   targetType="post"
 *   targetId="post-123"
 *   onClose={() => setShowModal(false)}
 * />
 * ```
 */
'use client'

// ============================================================
// インポート
// ============================================================

/**
 * useState - コンポーネントの状態管理フック
 * 通報理由、詳細説明、成功/エラー状態などを管理
 */
/**
 * useTransition - 非同期処理中の状態を管理するフック
 * Server Action実行中のローディング状態を追跡
 */
/**
 * useEffect - 副作用を処理するフック
 * マウント状態の管理とスクロールロック制御に使用
 */
import { useState, useTransition, useEffect } from 'react'

/**
 * createPortal - DOM階層外にコンポーネントをレンダリング
 * モーダルをbody直下に配置してz-index問題を回避
 */
import { createPortal } from 'react-dom'

/**
 * createReport - 通報を作成するServer Action
 * データベースに通報レコードを保存
 */
import { createReport } from '@/lib/actions/report'

/**
 * REPORT_REASONS - 通報理由の選択肢リスト
 * TARGET_TYPE_LABELS - 通報対象種別の日本語ラベル
 * ReportTargetType - 通報対象種別の型定義
 * ReportReason - 通報理由の型定義
 */
import { REPORT_REASONS, TARGET_TYPE_LABELS, type ReportTargetType, type ReportReason } from '@/lib/constants/report'

// ============================================================
// 型定義
// ============================================================

/**
 * ReportModalコンポーネントのプロパティ定義
 */
interface ReportModalProps {
  /**
   * 通報対象の種別
   * 'post' | 'comment' | 'user' | 'shop' | 'event' など
   */
  targetType: ReportTargetType

  /**
   * 通報対象のID
   * 対象コンテンツを一意に識別
   */
  targetId: string

  /**
   * モーダルを閉じる際のコールバック関数
   * 親コンポーネントで表示状態を管理
   */
  onClose: () => void
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 閉じる（X）アイコンコンポーネント
 * モーダルの閉じるボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 斜め線（左上から右下） */}
      <path d="M18 6 6 18"/>
      {/* 斜め線（左下から右上） */}
      <path d="m6 6 12 12"/>
    </svg>
  )
}

/**
 * チェックマーク円アイコンコンポーネント
 * 通報完了時の成功表示に使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 外側の円 */}
      <circle cx="12" cy="12" r="10"/>
      {/* チェックマーク */}
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 通報フォームモーダルコンポーネント
 *
 * ユーザーが不適切なコンテンツを通報するためのモーダルダイアログ。
 * 通報理由を選択し、任意で詳細説明を入力して送信できる。
 *
 * @param props - コンポーネントプロパティ
 * @returns Portal経由でレンダリングされるモーダル要素
 */
export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  // ============================================================
  // ステート管理
  // ============================================================

  /**
   * Server Action実行中のローディング状態を管理
   * isPending: 送信処理中はtrue
   * startTransition: 非同期処理を開始する関数
   */
  const [isPending, startTransition] = useTransition()

  /**
   * 選択された通報理由を管理
   * 空文字('')は未選択状態を示す
   */
  const [reason, setReason] = useState<ReportReason | ''>('')

  /**
   * 詳細説明テキストを管理
   * 任意入力フィールドの値
   */
  const [description, setDescription] = useState('')

  /**
   * 送信成功状態を管理
   * true: 成功メッセージを表示
   */
  const [success, setSuccess] = useState(false)

  /**
   * エラーメッセージを管理
   * null: エラーなし、string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * クライアントサイドマウント状態を管理
   * SSR時にcreatePortalを使用しないための制御
   */
  const [mounted, setMounted] = useState(false)

  // ============================================================
  // 副作用
  // ============================================================

  /**
   * コンポーネントマウント時の処理
   *
   * 1. クライアントサイドでのマウントを検出
   * 2. body要素のスクロールを無効化（モーダル表示中）
   * 3. クリーンアップ時にスクロールを復元
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- クライアントサイドマウント検出のため必要
    setMounted(true)
    // モーダル表示中はbodyのスクロールを無効化
    document.body.style.overflow = 'hidden'
    return () => {
      // コンポーネントアンマウント時にスクロールを復元
      document.body.style.overflow = ''
    }
  }, [])

  // ============================================================
  // イベントハンドラ
  // ============================================================

  /**
   * フォーム送信時のハンドラ
   *
   * 通報理由が選択されている場合のみ処理を実行。
   * Server Actionを呼び出して通報を作成し、
   * 成功時は完了メッセージを表示して2秒後に自動で閉じる。
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent) => {
    // デフォルトのフォーム送信を防止
    e.preventDefault()
    // 通報理由が未選択の場合は処理しない
    if (!reason) return

    // エラー状態をリセット
    setError(null)

    // useTransitionでServer Actionを実行
    startTransition(async () => {
      // 通報作成API呼び出し
      const result = await createReport({
        targetType,
        targetId,
        reason,
        description: description || undefined,
      })

      // エラーが返された場合
      if (result.error) {
        setError(result.error)
        return
      }

      // 成功時の処理
      setSuccess(true)
      // 2秒後にモーダルを自動で閉じる
      setTimeout(onClose, 2000)
    })
  }

  // ============================================================
  // レンダリング前の処理
  // ============================================================

  // クライアントサイドでのみレンダリング（SSR対策）
  if (!mounted) return null

  // ============================================================
  // モーダルコンテンツの定義
  // ============================================================

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* オーバーレイ - クリックでモーダルを閉じる */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* モーダルコンテナ - 中央配置用 */}
      <div className="min-h-full flex items-center justify-center p-4">
        {/* モーダル本体 */}
        <div
          className="relative bg-card rounded-lg border shadow-lg w-full max-w-md my-8"
          onClick={(e) => e.stopPropagation()} // モーダル内クリックでの閉じ防止
        >
        {/* ヘッダー - タイトルと閉じるボタン */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {/* 対象種別のラベルを表示（例: "投稿を通報"） */}
            {TARGET_TYPE_LABELS[targetType]}を通報
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ - 成功時とフォーム表示を切り替え */}
        {success ? (
          // 成功時の完了メッセージ
          <div className="p-8 text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">通報を受け付けました</p>
            <p className="text-sm text-muted-foreground">
              ご協力ありがとうございます。内容を確認し、適切に対応いたします。
            </p>
          </div>
        ) : (
          // 通報フォーム
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              {/* エラーメッセージ表示 */}
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-lg">
                  {error}
                </div>
              )}

              {/* 説明文 - 通報についての案内 */}
              <p className="text-sm text-muted-foreground">
                この{TARGET_TYPE_LABELS[targetType]}に問題がある場合は、以下から該当する理由を選択してください。
                通報内容は匿名で処理されます。
              </p>

              {/* 通報理由選択 - ラジオボタンリスト */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  通報理由 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {/* 定義済みの通報理由をループ表示 */}
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        reason === r.value
                          ? 'border-primary bg-primary/5' // 選択時のスタイル
                          : 'hover:bg-muted' // 未選択時のホバースタイル
                      }`}
                    >
                      {/* スクリーンリーダー専用の非表示ラジオボタン */}
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={(e) => setReason(e.target.value as ReportReason)}
                        className="sr-only"
                      />
                      {/* カスタムラジオボタンUI */}
                      <div
                        className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                          reason === r.value
                            ? 'border-primary'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {/* 選択時の内側ドット */}
                        {reason === r.value && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 詳細説明入力（任意） */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  詳細説明（任意）
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="問題の詳細があれば入力してください"
                />
                {/* 文字数カウンター */}
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {description.length}/500
                </p>
              </div>
            </div>

            {/* フッター - アクションボタン */}
            <div className="flex gap-3 p-4 border-t">
              {/* キャンセルボタン */}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border rounded-lg hover:bg-muted transition-colors"
              >
                キャンセル
              </button>
              {/* 送信ボタン - 理由未選択または送信中は無効化 */}
              <button
                type="submit"
                disabled={!reason || isPending}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? '送信中...' : '通報する'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  )

  // ============================================================
  // Portalを使用してbody直下にレンダリング
  // ============================================================

  return createPortal(modalContent, document.body)
}

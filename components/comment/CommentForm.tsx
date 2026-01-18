/**
 * コメントフォームコンポーネント
 *
 * このファイルは、投稿へのコメントを入力・送信するためのフォームを提供します。
 * 通常のコメントと返信コメントの両方に対応しています。
 *
 * ## 機能概要
 * - テキスト入力（500文字制限）
 * - 画像・動画のアップロード（画像2枚、動画1本まで）
 * - 返信機能（parentIdを指定）
 * - 文字数カウンター
 * - キャンセルボタン
 *
 * ## 使用箇所
 * - 投稿詳細ページのコメント欄
 * - コメントへの返信フォーム
 *
 * @module components/comment/CommentForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: フォームの状態管理
 * useTransition: 非同期処理中のペンディング状態管理
 * useRef: ファイル入力要素への参照
 */
import { useState, useTransition, useRef } from 'react'

/**
 * Next.js Imageコンポーネント
 * アップロードした画像のプレビュー表示に使用
 */
import Image from 'next/image'

/**
 * UIコンポーネント
 */
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * Server Actions
 *
 * createComment: コメントを作成
 * uploadCommentMedia: コメント用メディアをアップロード
 */
import { createComment, uploadCommentMedia } from '@/lib/actions/comment'

// ============================================================
// 型定義
// ============================================================

/**
 * CommentFormコンポーネントのprops型
 *
 * @property postId - コメント対象の投稿ID
 * @property parentId - 返信先コメントID（省略時は通常コメント）
 * @property onSuccess - 送信成功時のコールバック
 * @property onCancel - キャンセル時のコールバック
 * @property placeholder - プレースホルダーテキスト
 * @property autoFocus - 自動フォーカスするか
 */
type CommentFormProps = {
  postId: string
  parentId?: string
  onSuccess?: () => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 画像アイコン
 * メディア添付ボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

/**
 * バツ印アイコン
 * メディア削除ボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * コメントフォームコンポーネント
 *
 * ## 機能
 * - テキスト入力と文字数カウント
 * - 画像・動画のアップロード
 * - 送信とキャンセル
 *
 * ## 制限
 * - 文字数: 500文字まで
 * - 画像: 2枚まで
 * - 動画: 1本まで
 *
 * @param postId - 投稿ID
 * @param parentId - 返信先コメントID
 * @param onSuccess - 成功時コールバック
 * @param onCancel - キャンセル時コールバック
 * @param placeholder - プレースホルダー
 * @param autoFocus - 自動フォーカス
 *
 * @example
 * ```tsx
 * // 通常のコメント
 * <CommentForm postId="post123" />
 *
 * // 返信コメント
 * <CommentForm
 *   postId="post123"
 *   parentId="comment456"
 *   onSuccess={() => setShowReplyForm(false)}
 *   onCancel={() => setShowReplyForm(false)}
 *   placeholder="返信を入力..."
 *   autoFocus
 * />
 * ```
 */
export function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = 'コメントを入力...',
  autoFocus = false,
}: CommentFormProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * コメントテキストの内容
   */
  const [content, setContent] = useState('')

  /**
   * エラーメッセージ（nullの場合はエラーなし）
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 送信中のペンディング状態
   */
  const [isPending, startTransition] = useTransition()

  /**
   * アップロードされたメディアファイルの配列
   */
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>([])

  /**
   * メディアアップロード中のローディング状態
   */
  const [uploading, setUploading] = useState(false)

  /**
   * ファイル入力要素への参照
   */
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ------------------------------------------------------------
  // 計算値
  // ------------------------------------------------------------

  /**
   * 最大文字数
   */
  const maxLength = 500

  /**
   * 残り文字数
   */
  const remainingChars = maxLength - content.length

  /**
   * 文字数超過フラグ
   */
  const isOverLimit = remainingChars < 0

  /**
   * 送信可能かどうか
   * テキストかメディアがあり、文字数制限内の場合にtrue
   */
  const canSubmit = (content.trim().length > 0 || mediaFiles.length > 0) && !isOverLimit

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * ファイル選択時のハンドラ
   *
   * ## 処理フロー
   * 1. ファイルの種類（画像/動画）を判定
   * 2. 添付数の上限をチェック
   * 3. Server Actionでアップロード
   * 4. 成功時にmediaFiles配列に追加
   *
   * @param e - ファイル入力のchangeイベント
   */
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    /**
     * ファイルが動画かどうかを判定
     */
    const isVideo = file.type.startsWith('video/')

    /**
     * 現在添付されている画像と動画の数をカウント
     */
    const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
    const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

    /**
     * 画像の上限チェック（コメントは2枚まで）
     */
    if (!isVideo && currentImageCount >= 2) {
      setError('画像は2枚まで添付できます')
      return
    }

    /**
     * 動画の上限チェック（コメントは1本まで）
     */
    if (isVideo && currentVideoCount >= 1) {
      setError('動画は1本まで添付できます')
      return
    }

    /**
     * アップロード開始
     */
    setUploading(true)
    setError(null)

    /**
     * FormDataを作成してServer Actionに送信
     */
    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadCommentMedia(formData)

    /**
     * 結果の処理
     */
    if (result.error) {
      setError(result.error)
    } else if (result.url) {
      setMediaFiles([...mediaFiles, { url: result.url, type: result.type || 'image' }])
    }

    /**
     * アップロード完了処理
     */
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * メディアを削除するハンドラ
   *
   * @param index - 削除するメディアのインデックス
   */
  function removeMedia(index: number) {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
  }

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. フォームのデフォルト動作を防止
   * 2. 送信可能かチェック
   * 3. FormDataを構築
   * 4. Server Actionでコメントを作成
   * 5. 成功時: フォームリセット、onSuccessコールバック呼び出し
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent) {
    /**
     * フォームのデフォルト送信を防止
     */
    e.preventDefault()
    if (!canSubmit || isPending) return

    setError(null)

    /**
     * FormDataを構築
     */
    const formData = new FormData()
    formData.append('postId', postId)
    formData.append('content', content)

    /**
     * 返信コメントの場合は親IDを追加
     */
    if (parentId) {
      formData.append('parentId', parentId)
    }

    /**
     * メディアファイルをFormDataに追加
     */
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    /**
     * useTransitionでラップして送信
     */
    startTransition(async () => {
      const result = await createComment(formData)

      if (result.error) {
        setError(result.error)
      } else {
        /**
         * 成功時:
         * 1. フォームをリセット
         * 2. onSuccessコールバックを呼び出し
         */
        setContent('')
        setMediaFiles([])
        onSuccess?.()
      }
    })
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none pr-16"
          disabled={isPending}
          autoFocus={autoFocus}
        />
        <div
          className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit
              ? 'text-destructive'
              : remainingChars <= 50
              ? 'text-yellow-500'
              : 'text-muted-foreground'
          }`}
        >
          {remainingChars}
        </div>
      </div>

      {/* メディアプレビュー */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
          {mediaFiles.map((media, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {media.type === 'video' ? (
                <video src={media.url} className="w-full h-full object-cover" />
              ) : (
                <Image src={media.url} alt="" fill className="object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
              >
                <XIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isPending || mediaFiles.length >= 3}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          {uploading && <span className="text-sm text-muted-foreground">アップロード中...</span>}
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              キャンセル
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || isPending || uploading}
          >
            {isPending ? '送信中...' : parentId ? '返信する' : 'コメントする'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * 予約投稿フォームコンポーネント
 *
 * このファイルは、指定した日時に自動投稿する予約投稿を作成・編集するフォームを提供します。
 * プレミアム会員向けの機能として使用されます。
 *
 * ## 機能概要
 * - テキスト入力（文字数制限付き）
 * - 画像・動画のアップロード
 * - ジャンル選択
 * - 予約日時の指定
 * - 既存の予約投稿の編集
 *
 * ## 予約投稿の流れ
 * 1. ユーザーが投稿内容と予約日時を入力
 * 2. 「予約する」ボタンでServer Actionを呼び出し
 * 3. バックエンドのスケジューラーが指定日時に投稿を公開
 *
 * @module components/post/ScheduledPostForm
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: フォームの状態管理
 * useRef: ファイル入力要素への参照
 */
import { useState, useRef } from 'react'

/**
 * Next.js ナビゲーション
 * 予約投稿一覧への遷移に使用
 */
import { useRouter } from 'next/navigation'

/**
 * Next.js Imageコンポーネント
 * 画像の最適化と遅延読み込みを提供
 */
import Image from 'next/image'

/**
 * UIコンポーネント
 * shadcn/uiのButton, Textarea, Input, Labelを使用
 */
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Server Actions
 *
 * createScheduledPost: 予約投稿を作成
 * updateScheduledPost: 予約投稿を更新
 */
import { createScheduledPost, updateScheduledPost } from '@/lib/actions/scheduled-post'

/**
 * ジャンル選択コンポーネント
 */
import { GenreSelector } from './GenreSelector'

/**
 * クライアントサイド画像圧縮ユーティリティ
 */
import { prepareFileForUpload, isVideoFile, formatFileSize, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'

/**
 * Lucide Reactアイコン
 *
 * Calendar: 日付選択アイコン
 * Clock: 時間選択アイコン
 * ImageIcon: メディア追加ボタンアイコン
 * X: 削除ボタンアイコン
 */
import { Calendar, Clock, ImageIcon, X } from 'lucide-react'

/**
 * 会員種別による制限値の型
 */
import { MembershipLimits } from '@/lib/premium'

// ============================================================
// 型定義
// ============================================================

/**
 * ジャンル型
 *
 * @property id - ジャンルの一意識別子
 * @property name - ジャンル名（表示用）
 * @property category - カテゴリ（グループ化用）
 */
type Genre = {
  id: string
  name: string
  category: string
}

/**
 * ScheduledPostFormコンポーネントのProps型
 *
 * @property genres - カテゴリ別に分類されたジャンルのオブジェクト
 * @property limits - 会員種別による制限値
 * @property editData - 編集モード時の既存データ（省略時は新規作成）
 */
type ScheduledPostFormProps = {
  genres: Record<string, Genre[]>
  limits: MembershipLimits
  editData?: {
    /** 予約投稿のID */
    id: string
    /** 投稿テキスト */
    content: string | null
    /** 予約日時 */
    scheduledAt: Date
    /** 選択されたジャンルID配列 */
    genreIds: string[]
    /** 添付メディア */
    media: { url: string; type: string }[]
  }
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 予約投稿フォームコンポーネント
 *
 * ## 機能
 * - テキスト入力と文字数カウント
 * - 画像・動画のアップロードとプレビュー
 * - ジャンル選択（複数選択可）
 * - 予約日時の指定（日付と時間を別々に入力）
 * - 新規作成と編集の両方に対応
 *
 * ## 状態管理
 * - content: 投稿テキスト
 * - selectedGenres: 選択されたジャンルID配列
 * - mediaFiles: アップロードされたメディアファイル配列
 * - scheduledDate/scheduledTime: 予約日時
 * - loading/uploading: ローディング状態
 * - error: エラーメッセージ
 *
 * ## 日時バリデーション
 * - 予約日時は現在時刻より未来である必要がある
 * - 日付の最小値は今日
 *
 * @param genres - カテゴリ別ジャンルデータ
 * @param limits - 会員種別による制限値
 * @param editData - 編集時の既存データ（新規作成時は省略）
 *
 * @example
 * ```tsx
 * // 新規作成
 * <ScheduledPostForm
 *   genres={{ '盆栽': [...] }}
 *   limits={{ maxPostLength: 1000, maxImages: 8, maxVideos: 4 }}
 * />
 *
 * // 編集
 * <ScheduledPostForm
 *   genres={{ '盆栽': [...] }}
 *   limits={{ maxPostLength: 1000, maxImages: 8, maxVideos: 4 }}
 *   editData={{
 *     id: 'scheduled123',
 *     content: '予約投稿のテスト',
 *     scheduledAt: new Date('2024-12-01T10:00:00'),
 *     genreIds: ['genre1'],
 *     media: [],
 *   }}
 * />
 * ```
 */
export function ScheduledPostForm({ genres, limits, editData }: ScheduledPostFormProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Next.jsルーター
   * 予約完了後の遷移や戻るボタンに使用
   */
  const router = useRouter()

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 投稿テキストの内容
   * 編集時は既存の内容で初期化
   */
  const [content, setContent] = useState(editData?.content || '')

  /**
   * 選択されたジャンルのID配列
   * 編集時は既存の選択で初期化
   */
  const [selectedGenres, setSelectedGenres] = useState<string[]>(editData?.genreIds || [])

  /**
   * アップロードされたメディアファイルの配列
   * 編集時は既存のメディアで初期化
   */
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>(editData?.media || [])

  /**
   * 予約日（YYYY-MM-DD形式）
   * 編集時は既存の日付で初期化
   */
  const [scheduledDate, setScheduledDate] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toISOString().split('T')[0]
      : ''
  )

  /**
   * 予約時間（HH:MM形式）
   * 編集時は既存の時間で初期化
   */
  const [scheduledTime, setScheduledTime] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toTimeString().slice(0, 5)
      : ''
  )

  /**
   * 投稿送信中のローディング状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * メディアアップロード中のローディング状態
   */
  const [uploading, setUploading] = useState(false)

  /**
   * アップロード進捗（0-100%）
   */
  const [uploadProgress, setUploadProgress] = useState(0)

  /**
   * エラーメッセージ（nullの場合はエラーなし）
   */
  const [error, setError] = useState<string | null>(null)

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
  const maxChars = limits.maxPostLength

  /**
   * 残り文字数
   */
  const remainingChars = maxChars - content.length

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * ファイル選択時のハンドラ
   *
   * ## 処理フロー
   * 1. ファイルの種類（画像/動画）を判定
   * 2. 現在の添付数と上限をチェック
   * 3. 動画の場合はR2に直接アップロード
   * 4. 画像の場合はクライアントサイドで圧縮してアップロード
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
    const isVideo = isVideoFile(file)

    /**
     * 現在の添付数をカウント
     */
    const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
    const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

    /**
     * 上限チェック
     */
    if (!isVideo && currentImageCount >= limits.maxImages) {
      setError(`画像は${limits.maxImages}枚まで添付できます`)
      return
    }

    if (isVideo && currentVideoCount >= limits.maxVideos) {
      setError(`動画は${limits.maxVideos}本まで添付できます`)
      return
    }

    /**
     * 動画のファイルサイズチェック（R2直接アップロードで256MBまで対応）
     */
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      setError(`動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    /**
     * 画像のファイルサイズチェック（圧縮前）
     */
    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      setError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    /**
     * アップロード開始
     */
    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      /**
       * 動画の場合はR2に直接アップロード
       */
      if (isVideo) {
        const result = await uploadVideoToR2(file, 'scheduled', (progress) => {
          setUploadProgress(progress)
        })

        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setMediaFiles(prev => [...prev, { url: result.url!, type: 'video' }])
        }
      } else {
        /**
         * 画像の場合はクライアントサイドで圧縮
         */
        setError('画像を圧縮中...')
        const originalSize = file.size
        const fileToUpload = await prepareFileForUpload(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
        })
        const compressedSize = fileToUpload.size
        const ratio = Math.round((1 - compressedSize / originalSize) * 100)
        if (ratio > 0) {
          console.log(`圧縮完了: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${ratio}%削減)`)
        }
        setError(null)

        /**
         * FormDataを作成してアップロード
         */
        const formData = new FormData()
        formData.append('file', fileToUpload)

        /**
         * XMLHttpRequestを使用して進捗を追跡
         */
        const result = await new Promise<{ url?: string; type?: string; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest()

          /**
           * アップロード進捗イベント
           */
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              setUploadProgress(progress)
            }
          })

          /**
           * 完了イベント
           */
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText)
                resolve(response)
              } catch {
                resolve({ error: 'アップロードに失敗しました' })
              }
            } else {
              resolve({ error: 'アップロードに失敗しました' })
            }
          })

          /**
           * エラーイベント
           */
          xhr.addEventListener('error', () => {
            resolve({ error: 'アップロードに失敗しました' })
          })

          xhr.open('POST', '/api/upload')
          xhr.send(formData)
        })

        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setMediaFiles(prev => [...prev, { url: result.url!, type: result.type || 'image' }])
        }
      }
    } catch {
      setError('アップロードに失敗しました')
    } finally {
      /**
       * アップロード完了
       */
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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
   * フォーム送信時のハンドラ
   *
   * ## 処理フロー
   * 1. 予約日時のバリデーション
   * 2. FormDataを構築
   * 3. Server Actionで予約投稿を作成/更新
   * 4. 成功時: 予約投稿一覧に遷移
   * 5. 失敗時: エラーメッセージを表示
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * 予約日時の検証
     */
    if (!scheduledDate || !scheduledTime) {
      setError('予約日時を指定してください')
      setLoading(false)
      return
    }

    /**
     * 日付と時間を結合してDateオブジェクトを作成
     */
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    /**
     * 未来の日時かチェック
     */
    if (scheduledAt <= new Date()) {
      setError('予約日時は未来の日時を指定してください')
      setLoading(false)
      return
    }

    /**
     * FormDataを構築
     */
    const formData = new FormData()
    formData.append('content', content)
    formData.append('scheduledAt', scheduledAt.toISOString())
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    /**
     * 編集時はupdateScheduledPost、新規作成時はcreateScheduledPostを呼び出す
     */
    const result = editData
      ? await updateScheduledPost(editData.id, formData)
      : await createScheduledPost(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      /**
       * 成功時: 予約投稿一覧に遷移
       */
      router.push('/posts/scheduled')
      router.refresh()
    }
  }

  // ------------------------------------------------------------
  // 計算値（日付入力の最小値）
  // ------------------------------------------------------------

  /**
   * 現在の日時
   */
  const now = new Date()

  /**
   * 日付入力の最小値（今日）
   */
  const minDate = now.toISOString().split('T')[0]

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4 space-y-4">
      {/* テキスト入力エリア */}
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="予約投稿の内容を入力..."
          rows={5}
          maxLength={maxChars}
          className="resize-none border-0 focus-visible:ring-0 p-0 text-base"
        />
        {/* 文字数カウンター */}
        <div className="flex justify-end mt-1">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 100 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {remainingChars} / {maxChars}
          </span>
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
              {/* 削除ボタン */}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* メディア追加ボタン */}
      <div className="flex items-center gap-2">
        {/* 非表示のファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* メディア追加ボタン */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          メディア追加
        </Button>
        {/* アップロード進捗表示 */}
        {uploading && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-bonsai-green transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
          </div>
        )}
        {/* 現在の添付数表示 */}
        <span className="text-xs text-muted-foreground">
          画像: {mediaFiles.filter(m => m.type === 'image').length}/{limits.maxImages}枚,
          動画: {mediaFiles.filter(m => m.type === 'video').length}/{limits.maxVideos}本
        </span>
      </div>

      {/* ジャンル選択 */}
      <div>
        <Label className="text-sm font-medium mb-2 block">ジャンル</Label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {/* 予約日時 */}
      <div className="space-y-3 pt-4 border-t">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          予約日時
        </Label>
        <div className="flex gap-3">
          {/* 日付入力 */}
          <div className="flex-1">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={minDate}
              required
            />
          </div>
          {/* 時間入力 */}
          <div className="flex-1">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* アクションボタン */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {/* キャンセルボタン */}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          キャンセル
        </Button>
        {/* 予約/更新ボタン */}
        <Button
          type="submit"
          disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0 || !scheduledDate || !scheduledTime}
          className="bg-bonsai-green hover:bg-bonsai-green/90"
        >
          {loading ? '保存中...' : editData ? '更新する' : '予約する'}
        </Button>
      </div>
    </form>
  )
}

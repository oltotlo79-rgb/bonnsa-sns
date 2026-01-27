/**
 * 投稿フォームコンポーネント
 *
 * このファイルは、新規投稿を作成するためのフォームコンポーネントを提供します。
 * タイムラインページやモーダルで使用されます。
 *
 * ## 機能概要
 * - テキスト入力（文字数制限付き）
 * - 画像・動画のアップロード
 * - ジャンル選択
 * - 下書き保存
 * - 投稿送信
 *
 * ## プレミアム会員の特典
 * - より長い投稿文字数
 * - より多くの画像・動画添付
 *
 * ## 処理フロー
 * 1. ユーザーがテキストを入力
 * 2. オプションで画像/動画をアップロード
 * 3. ジャンルを選択
 * 4. 「投稿する」ボタンでServer Actionを呼び出し
 * 5. 成功時にタイムラインを更新
 *
 * @module components/post/PostForm
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
 * ルーターを使用してページ遷移やリフレッシュを行う
 */
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * React Query クライアント
 * タイムラインのキャッシュを無効化するために使用
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * Next.js Imageコンポーネント
 * 画像の最適化と遅延読み込みを提供
 */
import Image from 'next/image'

/**
 * UIコンポーネント
 * shadcn/uiのButtonを使用
 */
import { Button } from '@/components/ui/button'

/**
 * メンション機能付きテキストエリア
 * @入力でユーザーをオートコンプリート
 */
import { MentionTextarea } from '@/components/common/MentionTextarea'

/**
 * Server Actions
 *
 * createPost: 投稿を作成する
 */
import { createPost } from '@/lib/actions/post'

/**
 * クライアントサイド画像圧縮ユーティリティ
 *
 * アップロード前にブラウザ上で画像を圧縮してファイルサイズを削減
 */
import { prepareFileForUpload, isVideoFile, formatFileSize, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'

/**
 * 下書き保存用Server Action
 */
import { saveDraft } from '@/lib/actions/draft'

/**
 * ジャンル選択コンポーネント
 * 投稿にタグ付けするジャンルを選択
 */
import { GenreSelector } from './GenreSelector'

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
 * 会員種別による制限値
 *
 * プレミアム会員は通常会員より多くの文字数・メディアを使用可能
 *
 * @property maxPostLength - 投稿の最大文字数
 * @property maxImages - 添付可能な画像の最大枚数
 * @property maxVideos - 添付可能な動画の最大本数
 */
type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
}

/**
 * PostFormコンポーネントのProps型
 *
 * @property genres - カテゴリ別に分類されたジャンルのオブジェクト
 * @property limits - 会員種別による制限値（省略時はデフォルト値を使用）
 */
type PostFormProps = {
  genres: Record<string, Genre[]>
  limits?: MembershipLimits
  draftCount?: number
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 画像アイコンコンポーネント
 *
 * メディア添付ボタンに使用するSVGアイコン
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
 * バツ印アイコンコンポーネント
 *
 * メディアプレビューの削除ボタンに使用するSVGアイコン
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

/**
 * ファイルアイコン（下書き一覧リンク用）
 */
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}

// ============================================================
// 定数
// ============================================================

/**
 * 通常会員のデフォルト制限値
 *
 * プレミアム会員でない場合に適用される制限
 *
 * @property maxPostLength - 500文字まで
 * @property maxImages - 4枚まで
 * @property maxVideos - 1本まで
 */
const DEFAULT_LIMITS: MembershipLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
}


// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 投稿フォームコンポーネント
 *
 * ## 機能
 * - テキスト入力と文字数カウント
 * - 画像・動画のアップロードとプレビュー
 * - ジャンル選択（複数選択可）
 * - 下書き保存
 * - 投稿送信
 *
 * ## 状態管理
 * - content: 投稿テキスト
 * - selectedGenres: 選択されたジャンルID配列
 * - mediaFiles: アップロードされたメディアファイル配列
 * - loading/uploading/savingDraft: 各種ローディング状態
 * - error: エラーメッセージ
 *
 * @param genres - カテゴリ別ジャンルデータ
 * @param limits - 会員種別による制限値
 *
 * @example
 * ```tsx
 * <PostForm
 *   genres={{
 *     '盆栽': [{ id: '1', name: '松柏類', category: '盆栽' }],
 *   }}
 *   limits={{ maxPostLength: 1000, maxImages: 8, maxVideos: 4 }}
 * />
 * ```
 */
export function PostForm({ genres, limits = DEFAULT_LIMITS, draftCount = 0 }: PostFormProps) {
  // ------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------

  /**
   * Next.jsルーター
   * ページのリフレッシュや遷移に使用
   */
  const router = useRouter()

  /**
   * React Queryクライアント
   * 投稿成功時にタイムラインキャッシュを無効化
   */
  const queryClient = useQueryClient()

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 投稿テキストの内容
   */
  const [content, setContent] = useState('')

  /**
   * 選択されたジャンルのID配列
   */
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])

  /**
   * アップロードされたメディアファイルの配列
   * 各要素は { url: 'アップロード先URL', type: 'image' | 'video' }
   */
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>([])

  /**
   * 投稿送信中のローディング状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * 下書き保存中のローディング状態
   */
  const [savingDraft, setSavingDraft] = useState(false)

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
   * プログラムからファイル選択ダイアログを開くために使用
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
   * マイナスの場合は文字数超過
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
   * 3. 動画の場合はR2に直接アップロード（Vercel制限回避）
   * 4. 画像の場合はクライアントサイドで圧縮してアップロード
   * 5. 成功時にmediaFiles配列に追加
   *
   * @param e - ファイル入力のchangeイベント
   */
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    /**
     * ファイルが動画かどうかを判定
     * MIMEタイプが 'video/' で始まる場合は動画
     */
    const isVideo = isVideoFile(file)

    /**
     * 現在添付されている画像と動画の数をカウント
     */
    const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
    const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

    /**
     * 画像の上限チェック
     * 上限に達している場合はエラーを表示して終了
     */
    if (!isVideo && currentImageCount >= limits.maxImages) {
      setError(`画像は${limits.maxImages}枚まで添付できます`)
      return
    }

    /**
     * 動画の上限チェック
     * 上限に達している場合はエラーを表示して終了
     */
    if (isVideo && currentVideoCount >= limits.maxVideos) {
      setError(`動画は${limits.maxVideos}本まで添付できます`)
      return
    }

    /**
     * 動画のファイルサイズチェック
     * R2直接アップロードで256MBまで対応
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
     * ローディング状態をtrueにしてエラーをクリア
     */
    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      /**
       * 動画の場合はR2に直接アップロード
       * Vercelの4.5MB制限を回避して256MBまで対応
       */
      if (isVideo) {
        const result = await uploadVideoToR2(file, 'posts', (progress) => {
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
         * 通信量とストレージコストを削減
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
         * FormDataを作成してファイルを追加
         */
        const formData = new FormData()
        formData.append('file', fileToUpload)

        /**
         * XMLHttpRequestを使用して進捗を追跡しながらアップロード
         */
        const result = await new Promise<{ url?: string; type?: string; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest()

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              setUploadProgress(progress)
            }
          })

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

          xhr.addEventListener('error', () => {
            resolve({ error: 'アップロードに失敗しました' })
          })

          xhr.open('POST', '/api/upload')
          xhr.send(formData)
        })

        /**
         * 結果の処理
         * - エラーの場合: エラーメッセージを表示
         * - 成功の場合: mediaFiles配列に追加
         */
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
       * ローディング状態を解除し、ファイル入力をリセット
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
   * 指定されたインデックスのメディアをmediaFiles配列から削除
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
   * 1. フォームのデフォルト動作を防止
   * 2. FormDataを構築
   * 3. Server Actionで投稿を作成
   * 4. 成功時: フォームをリセットしてタイムラインを更新
   * 5. 失敗時: エラーメッセージを表示
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent) {
    /**
     * フォームのデフォルト送信を防止
     */
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * FormDataを構築
     * - content: 投稿テキスト
     * - genreIds: 選択されたジャンルID（複数可）
     * - mediaUrls/mediaTypes: アップロードされたメディア情報
     */
    const formData = new FormData()
    formData.append('content', content)
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    /**
     * Server Actionで投稿を作成
     */
    const result = await createPost(formData)

    if (result.error) {
      /**
       * エラーの場合: メッセージを表示
       */
      setError(result.error)
      setLoading(false)
    } else {
      /**
       * 成功の場合:
       * 1. フォームの状態をリセット
       * 2. React Queryのキャッシュを無効化（タイムラインを再取得）
       * 3. ページをリフレッシュ
       */
      setContent('')
      setSelectedGenres([])
      setMediaFiles([])
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      router.refresh()
      setLoading(false)
    }
  }

  /**
   * 下書き保存ハンドラ
   *
   * ## 処理フロー
   * 1. 入力内容の検証
   * 2. Server Actionで下書きを保存
   * 3. 成功時: フォームをリセットして下書きページに遷移
   * 4. 失敗時: エラーメッセージを表示
   */
  async function handleSaveDraft() {
    /**
     * 入力内容の検証
     * テキストもメディアもない場合はエラー
     */
    if (content.length === 0 && mediaFiles.length === 0) {
      setError('テキストまたは画像を入力してください')
      return
    }

    setSavingDraft(true)
    setError(null)

    try {
      /**
       * Server Actionで下書きを保存
       */
      const result = await saveDraft({
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if (result.error) {
        setError(result.error)
      } else {
        /**
         * 成功時:
         * 1. フォームの状態をリセット
         * 2. 下書き一覧ページに遷移
         */
        setContent('')
        setSelectedGenres([])
        setMediaFiles([])
        setError(null)
        router.push('/drafts')
      }
    } catch {
      /**
       * 予期せぬエラーの場合
       */
      setError('下書きの保存に失敗しました')
    } finally {
      /**
       * 常にローディング状態を解除
       */
      setSavingDraft(false)
    }
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4">
      <MentionTextarea
        value={content}
        onChange={setContent}
        placeholder="いまどうしてる？ @でユーザーをメンション"
        rows={3}
        maxLength={maxChars}
        className="border-0 focus-visible:ring-0 p-0 text-base"
      />

      {/* メディアプレビュー */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 mt-3 ${mediaFiles.length === 1 ? '' : mediaFiles.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
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

      {/* ジャンル選択 */}
      <div className="mt-3">
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive mt-3">{error}</p>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
            disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
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
          {limits.maxPostLength > 500 && (
            <span className="text-xs text-amber-600 font-medium">Premium</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {remainingChars}
          </span>
{draftCount > 0 && (
            <Link
              href="/drafts"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="下書き一覧"
            >
              <FileTextIcon className="w-4 h-4" />
              <span className="hidden sm:inline">一覧</span>
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={savingDraft || uploading || (content.length === 0 && mediaFiles.length === 0)}
          >
            {savingDraft ? '保存中...' : '下書き保存'}
          </Button>
          <Button
            type="submit"
            disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
            className="bg-bonsai-green hover:bg-bonsai-green/90"
          >
            {loading ? '投稿中...' : '投稿する'}
          </Button>
        </div>
      </div>
    </form>
  )
}

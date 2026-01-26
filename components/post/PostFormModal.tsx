/**
 * 投稿フォームモーダルコンポーネント
 *
 * このファイルは、モバイル画面で全画面表示される投稿フォームモーダルを提供します。
 * FAB（Floating Action Button）から開かれる投稿画面として使用されます。
 *
 * ## 機能概要
 * - テキスト入力（文字数制限付き）
 * - 画像・動画のアップロード
 * - ジャンル選択
 * - 下書き保存
 * - 投稿送信
 * - マイ盆栽との関連付け
 *
 * ## PostFormとの違い
 * - 全画面モーダルとして表示
 * - 閉じるボタンと確認ダイアログ
 * - アップロード中のキャンセル機能
 * - マイ盆栽の選択機能
 *
 * ## 処理フロー
 * 1. isOpen=trueでモーダルを表示
 * 2. ユーザーがテキスト/メディア/ジャンルを入力
 * 3. 「投稿する」で投稿、「下書き保存」で保存
 * 4. 完了後にonCloseコールバックでモーダルを閉じる
 *
 * @module components/post/PostFormModal
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React Hooks
 *
 * useState: フォームの状態管理
 * useRef: ファイル入力要素とAbortController への参照
 */
import { useState, useRef } from 'react'

/**
 * Next.js ナビゲーション
 * ルーターを使用してページ遷移やリフレッシュを行う
 */
import { useRouter } from 'next/navigation'

/**
 * Next.js Linkコンポーネント
 * 下書き一覧へのリンクに使用
 */
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
 * shadcn/uiのButtonとTextareaを使用
 */
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * Server Actions
 *
 * createPost: 投稿を作成する
 */
import { createPost } from '@/lib/actions/post'

/**
 * 下書き保存用Server Action
 */
import { saveDraft } from '@/lib/actions/draft'

/**
 * ジャンル選択コンポーネント
 * 投稿にタグ付けするジャンルを選択
 */
import { GenreSelector } from './GenreSelector'

/**
 * クライアントサイド画像圧縮ユーティリティ
 *
 * アップロード前にブラウザ上で画像を圧縮してファイルサイズを削減
 */
import { prepareFileForUpload, isVideoFile, formatFileSize, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'

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
 * 盆栽型
 *
 * マイ盆栽との関連付けに使用
 *
 * @property id - 盆栽の一意識別子
 * @property name - 盆栽の名前
 * @property species - 樹種（nullの場合もある）
 */
type Bonsai = {
  id: string
  name: string
  species: string | null
}

/**
 * PostFormModalコンポーネントのProps型
 *
 * @property genres - カテゴリ別に分類されたジャンルのオブジェクト
 * @property limits - 会員種別による制限値（省略時はデフォルト値を使用）
 * @property isOpen - モーダルの表示状態
 * @property onClose - モーダルを閉じるコールバック
 * @property draftCount - 下書きの数（0より大きい場合は下書き一覧リンクを表示）
 * @property bonsais - ユーザーのマイ盆栽リスト
 */
type PostFormModalProps = {
  genres: Record<string, Genre[]>
  limits?: MembershipLimits
  isOpen: boolean
  onClose: () => void
  draftCount?: number
  bonsais?: Bonsai[]
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
 * モーダルの閉じるボタンとメディアプレビューの削除ボタンに使用
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
 *
 * @param className - 追加のCSSクラス
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
 * 投稿フォームモーダルコンポーネント
 *
 * ## 機能
 * - 全画面モーダル形式の投稿フォーム
 * - テキスト入力と文字数カウント
 * - 画像・動画のアップロードとプレビュー
 * - ジャンル選択（複数選択可）
 * - マイ盆栽との関連付け
 * - 下書き保存
 * - 投稿送信
 *
 * ## 状態管理
 * - content: 投稿テキスト
 * - selectedGenres: 選択されたジャンルID配列
 * - mediaFiles: アップロードされたメディアファイル配列
 * - selectedBonsaiId: 関連付けるマイ盆栽のID
 * - loading/uploading/savingDraft: 各種ローディング状態
 * - error: エラーメッセージ
 *
 * ## キャンセル機能
 * アップロード中にAbortControllerを使用してキャンセル可能。
 * 閉じるボタンクリック時に確認ダイアログを表示。
 *
 * @param genres - カテゴリ別ジャンルデータ
 * @param limits - 会員種別による制限値
 * @param isOpen - モーダルの表示状態
 * @param onClose - モーダルを閉じるコールバック
 * @param draftCount - 下書きの数
 * @param bonsais - マイ盆栽リスト
 *
 * @example
 * ```tsx
 * <PostFormModal
 *   genres={{ '盆栽': [...] }}
 *   limits={{ maxPostLength: 500, maxImages: 4, maxVideos: 1 }}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   draftCount={3}
 *   bonsais={userBonsais}
 * />
 * ```
 */
export function PostFormModal({ genres, limits = DEFAULT_LIMITS, isOpen, onClose, draftCount = 0, bonsais = [] }: PostFormModalProps) {
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
   * 関連付けるマイ盆栽のID
   * 空文字の場合は関連付けなし
   */
  const [selectedBonsaiId, setSelectedBonsaiId] = useState<string>('')

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

  /**
   * AbortControllerへの参照
   * アップロードのキャンセルに使用
   */
  const abortControllerRef = useRef<AbortController | null>(null)

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
   * 6. キャンセル時は処理を中断
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
     */
    if (!isVideo && currentImageCount >= limits.maxImages) {
      setError(`画像は${limits.maxImages}枚まで添付できます`)
      return
    }

    /**
     * 動画の上限チェック
     */
    if (isVideo && currentVideoCount >= limits.maxVideos) {
      setError(`動画は${limits.maxVideos}本まで添付できます`)
      return
    }

    /**
     * 動画のファイルサイズチェック（256MB）
     */
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      setError(`動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    /**
     * 画像のファイルサイズチェック（圧縮前4MB）
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

    /**
     * AbortControllerを作成
     * キャンセル時にアップロードを中断するために使用
     */
    abortControllerRef.current = new AbortController()

    try {
      /**
       * 動画の場合はR2に直接アップロード
       */
      if (isVideo) {
        const result = await uploadVideoToR2(file, 'posts', (progress) => {
          setUploadProgress(progress)
        })

        /**
         * キャンセルされた場合は処理を中断
         */
        if (abortControllerRef.current?.signal.aborted) return

        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setMediaFiles(prev => [...prev, { url: result.url!, type: 'video' }])
        }
      } else {
        /**
         * 画像の場合は圧縮してからアップロード
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
         * FormDataを作成
         */
        const formData = new FormData()
        formData.append('file', fileToUpload)

        /**
         * XMLHttpRequestを使用して進捗を追跡
         * AbortControllerと連携してキャンセル可能に
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

          /**
           * キャンセルイベント
           */
          xhr.addEventListener('abort', () => {
            resolve({ error: 'アップロードがキャンセルされました' })
          })

          /**
           * AbortControllerのシグナルを監視
           * キャンセル時にXHRを中断
           */
          abortControllerRef.current?.signal.addEventListener('abort', () => {
            xhr.abort()
          })

          xhr.open('POST', '/api/upload')
          xhr.send(formData)
        })

        /**
         * キャンセルされた場合は処理を中断
         */
        if (abortControllerRef.current?.signal.aborted) return

        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setMediaFiles(prev => [...prev, { url: result.url!, type: result.type || 'image' }])
        }
      }
    } catch {
      /**
       * キャンセル以外のエラー
       */
      if (!abortControllerRef.current?.signal.aborted) {
        setError('アップロードに失敗しました')
      }
    } finally {
      /**
       * キャンセルされていない場合のみ状態をクリア
       */
      if (!abortControllerRef.current?.signal.aborted) {
        setUploading(false)
        setUploadProgress(0)
      }
      abortControllerRef.current = null
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
   * 1. FormDataを構築
   * 2. Server Actionで投稿を作成
   * 3. 成功時: フォームをリセットしてモーダルを閉じる
   * 4. 失敗時: エラーメッセージを表示
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * FormDataを構築
     */
    const formData = new FormData()
    formData.append('content', content)
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    /**
     * マイ盆栽が選択されている場合は追加
     */
    if (selectedBonsaiId) {
      formData.append('bonsaiId', selectedBonsaiId)
    }

    /**
     * Server Actionで投稿を作成
     */
    const result = await createPost(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      /**
       * 成功時: フォームをリセット
       */
      setContent('')
      setSelectedGenres([])
      setMediaFiles([])
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      router.refresh()
      setLoading(false)
      onClose()
    }
  }

  /**
   * モーダルを閉じるハンドラ
   *
   * ## 処理フロー
   * 1. アップロード中の場合: 確認ダイアログを表示し、キャンセル
   * 2. 入力内容がある場合: 確認ダイアログを表示
   * 3. 確認後: 状態をリセットしてonCloseを呼び出す
   */
  function handleClose() {
    /**
     * アップロード中の場合
     */
    if (uploading) {
      if (!confirm('アップロード中です。キャンセルしてもよろしいですか？')) {
        return
      }
      /**
       * アップロードをキャンセル
       */
      abortControllerRef.current?.abort()
    } else if (content.length > 0 || mediaFiles.length > 0) {
      /**
       * 入力内容がある場合
       */
      if (!confirm('入力内容が破棄されます。閉じてもよろしいですか？')) {
        return
      }
    }

    /**
     * 全ての状態をリセット
     */
    setContent('')
    setSelectedGenres([])
    setMediaFiles([])
    setSelectedBonsaiId('')
    setError(null)
    setUploading(false)
    setUploadProgress(0)
    abortControllerRef.current = null
    onClose()
  }

  /**
   * メディア追加ボタンクリックハンドラ
   *
   * ファイル選択ダイアログを開く
   */
  function handleMediaButtonClick() {
    fileInputRef.current?.click()
  }

  /**
   * 下書き保存ハンドラ
   *
   * ## 処理フロー
   * 1. 入力内容の検証
   * 2. Server Actionで下書きを保存
   * 3. 成功時: モーダルを閉じて下書きページに遷移
   * 4. 失敗時: エラーメッセージを表示
   */
  async function handleSaveDraft() {
    /**
     * 入力内容の検証
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
         * 成功時: フォームをリセットして下書きページに遷移
         */
        setContent('')
        setSelectedGenres([])
        setMediaFiles([])
        setError(null)
        onClose()
        router.push('/drafts')
      }
    } catch {
      setError('下書きの保存に失敗しました')
    } finally {
      setSavingDraft(false)
    }
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  /**
   * モーダルが閉じている場合は何も表示しない
   */
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>

          {/* アクションボタン群 */}
          <div className="flex items-center gap-2">
            {/* 下書き一覧リンク（下書きがある場合のみ表示） */}
            {draftCount > 0 && (
              <Link
                href="/drafts"
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                title="下書き一覧"
              >
                <FileTextIcon className="w-4 h-4" />
                <span className="hidden sm:inline">下書き一覧</span>
              </Link>
            )}

            {/* 下書き保存ボタン */}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft || uploading || (content.length === 0 && mediaFiles.length === 0)}
            >
              {savingDraft ? '保存中...' : '下書き保存'}
            </Button>

            {/* 投稿ボタン */}
            <Button
              onClick={handleSubmit}
              disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
              className="bg-bonsai-green hover:bg-bonsai-green/90"
            >
              {loading ? '投稿中...' : '投稿する'}
            </Button>
          </div>
        </div>
      </div>

      {/* フォーム */}
      <div className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit}>
          {/* テキスト入力エリア */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="いまどうしてる？"
            rows={6}
            maxLength={maxChars}
            autoFocus
            className="resize-none border-0 focus-visible:ring-0 p-0 text-lg"
          />

          {/* メディアプレビュー */}
          {mediaFiles.length > 0 && (
            <div className={`grid gap-2 mt-4 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
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
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
                  >
                    <XIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* メディア追加・文字数 */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
                variant="ghost"
                size="sm"
                onClick={handleMediaButtonClick}
                disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
              >
                <ImageIcon className="w-5 h-5" />
                <span className="ml-1 text-sm">画像/動画</span>
              </Button>
              {/* アップロード進捗表示 */}
              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-bonsai-green transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                </div>
              )}
            </div>

            {/* 残り文字数表示 */}
            <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
              {remainingChars}
            </span>
          </div>

          {/* マイ盆栽選択（盆栽がある場合のみ表示） */}
          {bonsais.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                関連する盆栽（任意）
              </label>
              <select
                value={selectedBonsaiId}
                onChange={(e) => setSelectedBonsaiId(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">選択しない</option>
                {bonsais.map((bonsai) => (
                  <option key={bonsai.id} value={bonsai.id}>
                    {bonsai.name}{bonsai.species ? ` (${bonsai.species})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ジャンル選択 */}
          <div className="mt-4">
            <GenreSelector
              genres={genres}
              selectedIds={selectedGenres}
              onChange={setSelectedGenres}
            />
          </div>

          {/* エラーメッセージ */}
          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}

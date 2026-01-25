/**
 * @file DraftEditForm.tsx
 * @description 下書き編集フォームコンポーネント
 *
 * このコンポーネントは、下書き投稿を編集するためのフォームUIを提供します。
 * テキスト編集、メディアアップロード、ジャンル選択、保存/投稿/削除の
 * 各機能を統合した編集画面です。
 *
 * @features
 * - テキスト編集（最大500文字、リアルタイム文字数カウント）
 * - 画像/動画のアップロード（画像は4枚まで、動画は1本）
 * - 画像の自動圧縮（クライアントサイド）
 * - アップロード進捗表示
 * - ジャンル選択（最大3つ）
 * - 下書き保存、投稿、削除の各アクション
 * - 大容量動画のR2直接アップロード対応
 *
 * @usage
 * ```tsx
 * <DraftEditForm draft={draftData} genres={genresByCategory} />
 * ```
 */
'use client'

// ============================================================
// インポート
// ============================================================

/**
 * useState - コンポーネントの状態管理フック
 * フォーム入力値やローディング状態を管理
 */
/**
 * useRef - DOM要素への参照を保持するフック
 * ファイル入力要素への参照に使用
 */
import { useState, useRef } from 'react'

/**
 * useRouter - Next.jsのルーターフック
 * ページ遷移とデータ再検証に使用
 */
import { useRouter } from 'next/navigation'

/**
 * Image - Next.jsの最適化画像コンポーネント
 * メディアプレビューの表示に使用
 */
import Image from 'next/image'

/**
 * Button - shadcn/uiのボタンコンポーネント
 * 各種アクションボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * Textarea - shadcn/uiのテキストエリアコンポーネント
 * 投稿本文の入力に使用
 */
import { Textarea } from '@/components/ui/textarea'

/**
 * saveDraft - 下書き保存のServer Action
 * publishDraft - 下書きを投稿に変換するServer Action
 * deleteDraft - 下書き削除のServer Action
 */
import { saveDraft, publishDraft, deleteDraft } from '@/lib/actions/draft'

/**
 * GenreSelector - ジャンル選択コンポーネント
 * 投稿のジャンル分類を選択するUI
 */
import { GenreSelector } from '@/components/post/GenreSelector'

/**
 * prepareFileForUpload - アップロード前のファイル準備（圧縮等）
 * isVideoFile - ファイルが動画かどうかを判定
 * formatFileSize - ファイルサイズを人間が読みやすい形式に変換
 * MAX_IMAGE_SIZE - 画像の最大サイズ定数
 * MAX_VIDEO_SIZE - 動画の最大サイズ定数
 * uploadVideoToR2 - 動画をR2に直接アップロード
 */
import { prepareFileForUpload, isVideoFile, formatFileSize, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'

// ============================================================
// 型定義
// ============================================================

/**
 * ジャンルデータの型定義
 */
type Genre = {
  /** ジャンルの一意識別子 */
  id: string
  /** ジャンル名（表示用） */
  name: string
  /** カテゴリ名（グループ分け用） */
  category: string
}

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
    /** ジャンル名 */
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
  /** 添付メディアの配列 */
  media: DraftMedia[]
  /** 紐づくジャンルの配列 */
  genres: DraftGenre[]
}

/**
 * DraftEditFormコンポーネントのプロパティ定義
 */
interface DraftEditFormProps {
  /** 編集対象の下書きデータ */
  draft: Draft
  /** カテゴリ別に整理されたジャンルデータ */
  genres: Record<string, Genre[]>
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 画像アイコンコンポーネント
 * 画像追加ボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 画像フレーム */}
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      {/* 太陽 */}
      <circle cx="9" cy="9" r="2" />
      {/* 山の風景線 */}
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

/**
 * 閉じる（X）アイコンコンポーネント
 * メディア削除ボタンに使用
 *
 * @param className - SVGに適用するCSSクラス
 * @returns SVG要素
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* X印の2本の線 */}
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

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
      {/* ゴミ箱の取っ手 */}
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 下書き編集フォームコンポーネント
 *
 * 下書き投稿を編集するためのフルフィーチャーフォーム。
 * テキスト、メディア、ジャンルの編集と、保存/投稿/削除の各アクションを提供。
 *
 * @param props - コンポーネントプロパティ
 * @returns 編集フォームのReact要素
 */
export function DraftEditForm({ draft, genres }: DraftEditFormProps) {
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
   * 投稿本文を管理
   * 初期値は下書きの現在の内容（nullの場合は空文字）
   */
  const [content, setContent] = useState(draft.content || '')

  /**
   * 選択されたジャンルIDの配列を管理
   * 初期値は下書きに紐づくジャンルのID
   */
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    draft.genres.map((g) => g.genreId)
  )

  /**
   * 添付メディアファイルの配列を管理
   * URLと種別のオブジェクト配列
   */
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: string }[]>(
    draft.media.map((m) => ({ url: m.url, type: m.type }))
  )

  /**
   * 保存処理中の状態を管理
   */
  const [saving, setSaving] = useState(false)

  /**
   * 投稿処理中の状態を管理
   */
  const [publishing, setPublishing] = useState(false)

  /**
   * 削除処理中の状態を管理
   */
  const [deleting, setDeleting] = useState(false)

  /**
   * アップロード処理中の状態を管理
   */
  const [uploading, setUploading] = useState(false)

  /**
   * アップロード進捗（0-100%）を管理
   */
  const [uploadProgress, setUploadProgress] = useState(0)

  /**
   * エラーメッセージを管理
   * null: エラーなし、string: エラー内容
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ファイル入力要素への参照
   * プログラムからファイル選択ダイアログを開くために使用
   */
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================================
  // 定数・計算値
  // ============================================================

  /** 投稿本文の最大文字数 */
  const maxChars = 500

  /** 残り入力可能文字数 */
  const remainingChars = maxChars - content.length

  // ============================================================
  // イベントハンドラ
  // ============================================================

  /**
   * ファイル選択時のハンドラ
   *
   * 選択されたファイルをバリデーションし、
   * 画像は圧縮後にアップロード、動画はR2に直接アップロード。
   *
   * @param e - ファイル入力の変更イベント
   */
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isVideo = isVideoFile(file)

    // メディア数の上限チェック
    if (mediaFiles.length >= 4) {
      setError('画像は4枚まで添付できます')
      return
    }

    // 動画のファイルサイズチェック（R2直接アップロードで256MBまで対応）
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      setError(`動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // 画像のファイルサイズチェック（圧縮前）
    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      setError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // アップロード処理開始
    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // 動画の場合はR2に直接アップロード
      if (isVideo) {
        const result = await uploadVideoToR2(file, 'drafts', (progress) => {
          setUploadProgress(progress)
        })

        if (result.error) {
          setError(result.error)
        } else if (result.url) {
          setMediaFiles(prev => [...prev, { url: result.url!, type: 'video' }])
        }
      } else {
        // 画像の場合はクライアントサイドで圧縮
        setError('画像を圧縮中...')
        const originalSize = file.size

        // 圧縮処理（最大1MB、最大幅/高さ1920px）
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

        // FormDataでアップロード
        const formData = new FormData()
        formData.append('file', fileToUpload)

        // XMLHttpRequestを使用して進捗を追跡
        const result = await new Promise<{ url?: string; type?: string; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest()

          // アップロード進捗イベント
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              setUploadProgress(progress)
            }
          })

          // 完了イベント
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

          // エラーイベント
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
      setUploading(false)
      setUploadProgress(0)
      // ファイル入力をリセット（同じファイルの再選択を可能に）
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  /**
   * メディア削除ハンドラ
   *
   * 指定されたインデックスのメディアを配列から削除
   *
   * @param index - 削除するメディアのインデックス
   */
  function removeMedia(index: number) {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
  }

  /**
   * 下書き保存ハンドラ
   *
   * 現在の編集内容を下書きとして保存し、
   * 成功したら下書き一覧ページに戻る
   */
  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const result = await saveDraft({
        id: draft.id,
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/drafts')
        router.refresh()
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  /**
   * 投稿ハンドラ
   *
   * 確認ダイアログ後、まず保存してから投稿に変換。
   * 成功したらフィードページに遷移。
   */
  async function handlePublish() {
    // 投稿確認ダイアログ
    if (!confirm('この下書きを投稿しますか？')) return

    setPublishing(true)
    setError(null)

    // まず保存してから投稿（編集内容を反映するため）
    try {
      const saveResult = await saveDraft({
        id: draft.id,
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if (saveResult.error) {
        setError(saveResult.error)
        setPublishing(false)
        return
      }

      // 投稿に変換
      const result = await publishDraft(draft.id)

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/feed')
        router.refresh()
      }
    } catch {
      setError('投稿に失敗しました')
    } finally {
      setPublishing(false)
    }
  }

  /**
   * 削除ハンドラ
   *
   * 確認ダイアログ後、下書きを削除。
   * 成功したら下書き一覧ページに戻る。
   */
  async function handleDelete() {
    // 削除確認ダイアログ
    if (!confirm('この下書きを削除しますか？')) return

    setDeleting(true)
    try {
      const result = await deleteDraft(draft.id)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/drafts')
        router.refresh()
      }
    } catch {
      setError('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    <div className="space-y-4">
      {/* 本文入力テキストエリア */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={5}
        maxLength={maxChars}
        className="resize-none"
      />

      {/* 文字数カウント表示 */}
      <div className="text-right">
        <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
          {remainingChars}
        </span>
      </div>

      {/* メディアプレビューグリッド */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
          {mediaFiles.map((media, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {media.type === 'video' ? (
                // 動画プレビュー
                <video src={media.url} className="w-full h-full object-cover" />
              ) : (
                // 画像プレビュー
                <Image src={media.url} alt="" fill className="object-cover" />
              )}
              {/* 削除ボタン（オーバーレイ） */}
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

      {/* 画像追加ボタンとアップロード進捗 */}
      <div className="flex items-center gap-2">
        {/* 非表示のファイル入力（プログラムから制御） */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* 画像追加ボタン */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || mediaFiles.length >= 4}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          画像を追加
        </Button>
        {/* アップロード進捗バー */}
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
      </div>

      {/* ジャンル選択セクション */}
      <div>
        <label className="block text-sm font-medium mb-2">ジャンル</label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {/* エラーメッセージ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* アクションボタンセクション */}
      <div className="flex items-center justify-between pt-4 border-t">
        {/* 左側: 削除ボタン */}
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          {deleting ? '削除中...' : '削除'}
        </Button>

        {/* 右側: 保存・投稿ボタン */}
        <div className="flex gap-2">
          {/* 下書き保存ボタン */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '下書き保存'}
          </Button>
          {/* 投稿ボタン - 内容がない場合や文字数オーバー時は無効化 */}
          <Button
            type="button"
            onClick={handlePublish}
            disabled={publishing || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
            className="bg-bonsai-green hover:bg-bonsai-green/90"
          >
            {publishing ? '投稿中...' : '投稿する'}
          </Button>
        </div>
      </div>
    </div>
  )
}

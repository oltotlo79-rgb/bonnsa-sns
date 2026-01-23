/**
 * クライアントサイド画像圧縮ユーティリティ
 *
 * ブラウザ上で画像を圧縮してからアップロードすることで、
 * 通信量とストレージコストを削減します。
 *
 * @module lib/client-image-compression
 */

import imageCompression from 'browser-image-compression'

/**
 * 画像圧縮オプションの型
 */
export interface CompressionOptions {
  /** 最大ファイルサイズ（MB） */
  maxSizeMB?: number
  /** 最大幅または高さ（px） */
  maxWidthOrHeight?: number
  /** 圧縮に使用するCPUコア数 */
  maxIteration?: number
  /** WebWorkerを使用するか */
  useWebWorker?: boolean
  /** 元のファイル形式を維持するか */
  preserveExif?: boolean
}

/**
 * 圧縮結果の型
 */
export interface CompressionResult {
  /** 圧縮後のファイル */
  file: File
  /** 元のサイズ（バイト） */
  originalSize: number
  /** 圧縮後のサイズ（バイト） */
  compressedSize: number
  /** 圧縮率（%） */
  compressionRatio: number
}

/**
 * デフォルトの圧縮オプション
 *
 * - 最大1MB（ストレージコスト削減）
 * - 最大1920px（Full HD相当）
 * - WebWorkerで非同期処理
 */
const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  preserveExif: false,
}

/**
 * 画像の最大ファイルサイズ（圧縮前）
 * ユーザーがアップロードできる画像の上限
 */
export const MAX_IMAGE_SIZE = 4 * 1024 * 1024 // 4MB

/**
 * 動画の最大ファイルサイズ
 * R2への直接アップロードで256MBまで対応
 */
export const MAX_VIDEO_SIZE = 256 * 1024 * 1024 // 256MB

/**
 * 画像を圧縮する
 *
 * @param file - 圧縮する画像ファイル
 * @param options - 圧縮オプション
 * @returns 圧縮結果
 *
 * @example
 * ```typescript
 * const result = await compressImage(file)
 * console.log(`${result.originalSize} → ${result.compressedSize} (${result.compressionRatio}%削減)`)
 * ```
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = file.size

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: mergedOptions.maxSizeMB,
      maxWidthOrHeight: mergedOptions.maxWidthOrHeight,
      useWebWorker: mergedOptions.useWebWorker,
      preserveExif: mergedOptions.preserveExif,
    })

    const compressedSize = compressedFile.size
    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio: Math.max(0, compressionRatio),
    }
  } catch (error) {
    console.error('Image compression failed:', error)
    // 圧縮に失敗した場合は元のファイルを返す
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    }
  }
}

/**
 * 画像ファイルかどうかを判定
 *
 * @param file - 判定するファイル
 * @returns 画像ファイルならtrue
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * 動画ファイルかどうかを判定
 *
 * @param file - 判定するファイル
 * @returns 動画ファイルならtrue
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 *
 * @param bytes - バイト数
 * @returns フォーマットされた文字列
 *
 * @example
 * ```typescript
 * formatFileSize(1024) // "1.0 KB"
 * formatFileSize(1048576) // "1.0 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * 画像を圧縮してFormDataに追加するヘルパー
 *
 * @param file - 元のファイル
 * @param options - 圧縮オプション
 * @returns 圧縮後のファイル（動画の場合はそのまま返す）
 */
export async function prepareFileForUpload(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // 動画ファイルは圧縮せずにそのまま返す
  if (isVideoFile(file)) {
    return file
  }

  // 画像ファイルは圧縮
  if (isImageFile(file)) {
    const result = await compressImage(file, options)
    if (result.compressionRatio > 0) {
      console.log(
        `Image compressed: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${result.compressionRatio}% reduced)`
      )
    }
    return result.file
  }

  // その他のファイルはそのまま
  return file
}

/**
 * 動画アップロード結果の型
 */
export interface VideoUploadResult {
  url?: string
  error?: string
}

/**
 * 動画をR2に直接アップロード（Presigned URL使用）
 *
 * Vercelの4.5MB制限を回避して、大きな動画ファイルを直接R2にアップロードします。
 *
 * @param file - アップロードする動画ファイル
 * @param folder - 保存先フォルダ（デフォルト: 'posts'）
 * @param onProgress - 進捗コールバック（0-100）
 * @returns アップロード結果（URLまたはエラー）
 */
export async function uploadVideoToR2(
  file: File,
  folder: string = 'posts',
  onProgress?: (progress: number) => void
): Promise<VideoUploadResult> {
  try {
    // ファイルサイズチェック
    if (file.size > MAX_VIDEO_SIZE) {
      return {
        error: `動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
      }
    }

    // 1. Presigned URLを取得
    const presignedResponse = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: file.type,
        fileSize: file.size,
        folder,
      }),
    })

    if (!presignedResponse.ok) {
      const errorData = await presignedResponse.json()
      return { error: errorData.error || 'Presigned URLの取得に失敗しました' }
    }

    const { presignedUrl, fileUrl } = await presignedResponse.json()

    // 2. R2に直接アップロード（XMLHttpRequestで進捗追跡）
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: fileUrl })
        } else {
          resolve({ error: 'アップロードに失敗しました' })
        }
      })

      xhr.addEventListener('error', () => {
        resolve({ error: 'アップロードに失敗しました' })
      })

      xhr.addEventListener('abort', () => {
        resolve({ error: 'アップロードがキャンセルされました' })
      })

      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  } catch (error) {
    console.error('Video upload error:', error)
    return { error: 'アップロードに失敗しました' }
  }
}

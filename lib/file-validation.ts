/**
 * ファイルバリデーションユーティリティ
 *
 * ファイルアップロード時のセキュリティ検証を提供
 * MIMEタイプの偽装を防ぐため、ファイルのマジックバイト（シグネチャ）を検証
 *
 * @module lib/file-validation
 */

// ============================================================
// 型定義
// ============================================================

/**
 * ファイルシグネチャの定義
 */
type FileSignature = {
  /** MIMEタイプ */
  mimeType: string
  /** マジックバイト（ファイル先頭のバイト列） */
  signatures: number[][]
  /** オフセット（シグネチャの開始位置、デフォルト0） */
  offset?: number
}

/**
 * ファイル検証結果
 */
export type FileValidationResult = {
  /** 検証成功かどうか */
  valid: boolean
  /** 検出されたMIMEタイプ（成功時） */
  detectedType?: string
  /** エラーメッセージ（失敗時） */
  error?: string
}

// ============================================================
// 定数
// ============================================================

/**
 * サポートされるファイル形式のシグネチャ定義
 *
 * 各形式のマジックバイト（ファイルヘッダー）を定義
 * 複数のシグネチャパターンを持つ形式もある
 */
const FILE_SIGNATURES: FileSignature[] = [
  // JPEG - FFD8FFで始まる
  {
    mimeType: 'image/jpeg',
    signatures: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // EXIF
      [0xFF, 0xD8, 0xFF, 0xE2], // ICC
      [0xFF, 0xD8, 0xFF, 0xE3],
      [0xFF, 0xD8, 0xFF, 0xE8],
      [0xFF, 0xD8, 0xFF, 0xDB], // Raw JPEG
      [0xFF, 0xD8, 0xFF, 0xEE], // Adobe
    ],
  },
  // PNG - 89504E47で始まる
  {
    mimeType: 'image/png',
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  },
  // WebP - RIFFxxxxWEBP
  {
    mimeType: 'image/webp',
    signatures: [[0x52, 0x49, 0x46, 0x46]], // "RIFF" (WEBPは8バイト目以降でチェック)
  },
  // GIF - GIF87a or GIF89a
  {
    mimeType: 'image/gif',
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
  },
  // MP4 - ftyp
  {
    mimeType: 'video/mp4',
    signatures: [
      [0x66, 0x74, 0x79, 0x70], // "ftyp" at offset 4
    ],
    offset: 4,
  },
  // QuickTime MOV - ftyp or moov
  {
    mimeType: 'video/quicktime',
    signatures: [
      [0x66, 0x74, 0x79, 0x70], // "ftyp" at offset 4
      [0x6D, 0x6F, 0x6F, 0x76], // "moov" at offset 4
    ],
    offset: 4,
  },
  // WebM - 1A45DFA3
  {
    mimeType: 'video/webm',
    signatures: [[0x1A, 0x45, 0xDF, 0xA3]],
  },
  // AVI - RIFF....AVI
  {
    mimeType: 'video/x-msvideo',
    signatures: [[0x52, 0x49, 0x46, 0x46]], // "RIFF"
  },
]

/**
 * 画像形式のMIMEタイプセット
 */
export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

/**
 * 動画形式のMIMEタイプセット
 */
export const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
])

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * バイト配列がシグネチャと一致するかチェック
 *
 * @param buffer - チェック対象のバッファ
 * @param signature - 期待されるシグネチャ
 * @param offset - 比較開始位置
 * @returns 一致すればtrue
 */
function matchesSignature(
  buffer: Buffer,
  signature: number[],
  offset: number = 0
): boolean {
  if (buffer.length < offset + signature.length) {
    return false
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false
    }
  }
  return true
}

/**
 * WebPファイルかどうかを追加チェック
 *
 * WebPはRIFFコンテナを使用するため、
 * ファイルの8バイト目以降に"WEBP"があるかを確認
 *
 * @param buffer - チェック対象のバッファ
 * @returns WebPならtrue
 */
function isWebP(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  // RIFF....WEBP
  return (
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50    // P
  )
}

/**
 * AVIファイルかどうかを追加チェック
 *
 * AVIもRIFFコンテナを使用するため、
 * ファイルの8バイト目以降に"AVI "があるかを確認
 *
 * @param buffer - チェック対象のバッファ
 * @returns AVIならtrue
 */
function isAVI(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  // RIFF....AVI
  return (
    buffer[8] === 0x41 && // A
    buffer[9] === 0x56 && // V
    buffer[10] === 0x49 && // I
    buffer[11] === 0x20    // (space)
  )
}

// ============================================================
// メイン検証関数
// ============================================================

/**
 * ファイルのシグネチャを検証してMIMEタイプを検出
 *
 * ファイルの先頭バイト（マジックバイト）を解析し、
 * 実際のファイル形式を特定する
 *
 * @param buffer - ファイルのバッファ
 * @returns 検出されたMIMEタイプ、または検出できない場合はnull
 *
 * @example
 * ```typescript
 * const buffer = Buffer.from(await file.arrayBuffer())
 * const mimeType = detectFileType(buffer)
 * if (mimeType === 'image/jpeg') {
 *   // JPEG画像として処理
 * }
 * ```
 */
export function detectFileType(buffer: Buffer): string | null {
  for (const fileSig of FILE_SIGNATURES) {
    const offset = fileSig.offset || 0

    for (const signature of fileSig.signatures) {
      if (matchesSignature(buffer, signature, offset)) {
        // RIFFコンテナの場合は追加チェック
        if (fileSig.mimeType === 'image/webp') {
          if (isWebP(buffer)) return 'image/webp'
          continue // WebPでなければ次のシグネチャをチェック
        }
        if (fileSig.mimeType === 'video/x-msvideo') {
          if (isAVI(buffer)) return 'video/x-msvideo'
          continue
        }
        return fileSig.mimeType
      }
    }
  }

  return null
}

/**
 * 画像ファイルを検証
 *
 * MIMEタイプとファイルシグネチャの両方をチェックし、
 * 許可された画像形式かどうかを検証
 *
 * @param buffer - ファイルのバッファ
 * @param claimedMimeType - クライアントが主張するMIMEタイプ
 * @param allowedTypes - 許可するMIMEタイプの配列（省略時はデフォルトの画像形式）
 * @returns 検証結果
 *
 * @example
 * ```typescript
 * const buffer = Buffer.from(await file.arrayBuffer())
 * const result = validateImageFile(buffer, file.type)
 * if (!result.valid) {
 *   return { error: result.error }
 * }
 * ```
 */
export function validateImageFile(
  buffer: Buffer,
  claimedMimeType: string,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']
): FileValidationResult {
  // 1. 主張されたMIMEタイプが許可リストにあるか
  if (!allowedTypes.includes(claimedMimeType)) {
    return {
      valid: false,
      error: `許可されていないファイル形式です。対応形式: ${allowedTypes.join(', ')}`,
    }
  }

  // 2. ファイルシグネチャから実際のタイプを検出
  const detectedType = detectFileType(buffer)

  if (!detectedType) {
    return {
      valid: false,
      error: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
    }
  }

  // 3. 検出されたタイプが許可リストにあるか
  if (!allowedTypes.includes(detectedType)) {
    return {
      valid: false,
      error: `ファイルの実際の形式（${detectedType}）は許可されていません`,
    }
  }

  // 4. 主張と検出が一致するか（厳密チェック、省略可能）
  // 注: 一部のケースでは不一致でも問題ない場合がある
  // 例: MOVファイルがvideo/mp4として送信される等

  return {
    valid: true,
    detectedType,
  }
}

/**
 * 動画ファイルを検証
 *
 * MIMEタイプとファイルシグネチャの両方をチェックし、
 * 許可された動画形式かどうかを検証
 *
 * @param buffer - ファイルのバッファ
 * @param claimedMimeType - クライアントが主張するMIMEタイプ
 * @param allowedTypes - 許可するMIMEタイプの配列（省略時はデフォルトの動画形式）
 * @returns 検証結果
 */
export function validateVideoFile(
  buffer: Buffer,
  claimedMimeType: string,
  allowedTypes: string[] = ['video/mp4', 'video/quicktime', 'video/webm']
): FileValidationResult {
  // 1. 主張されたMIMEタイプが動画形式か
  if (!claimedMimeType.startsWith('video/')) {
    return {
      valid: false,
      error: '動画ファイルを選択してください',
    }
  }

  // 2. ファイルシグネチャから実際のタイプを検出
  const detectedType = detectFileType(buffer)

  if (!detectedType) {
    return {
      valid: false,
      error: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
    }
  }

  // 3. 検出されたタイプが動画形式か
  if (!VIDEO_MIME_TYPES.has(detectedType)) {
    return {
      valid: false,
      error: 'このファイルは有効な動画ファイルではありません',
    }
  }

  // 4. 検出されたタイプが許可リストにあるか
  if (!allowedTypes.includes(detectedType)) {
    return {
      valid: false,
      error: `動画形式（${detectedType}）は対応していません。対応形式: ${allowedTypes.join(', ')}`,
    }
  }

  return {
    valid: true,
    detectedType,
  }
}

/**
 * メディアファイル（画像または動画）を検証
 *
 * ファイルの種類を自動判定し、適切な検証を実行
 *
 * @param buffer - ファイルのバッファ
 * @param claimedMimeType - クライアントが主張するMIMEタイプ
 * @returns 検証結果
 */
export function validateMediaFile(
  buffer: Buffer,
  claimedMimeType: string
): FileValidationResult {
  if (claimedMimeType.startsWith('image/')) {
    return validateImageFile(buffer, claimedMimeType)
  }

  if (claimedMimeType.startsWith('video/')) {
    return validateVideoFile(buffer, claimedMimeType)
  }

  return {
    valid: false,
    error: '画像または動画ファイルを選択してください',
  }
}

/**
 * 安全なファイル名を生成
 *
 * 元のファイル名からパストラバーサル攻撃を防ぐため、
 * UUIDベースの安全なファイル名を生成
 *
 * @param originalName - 元のファイル名
 * @param mimeType - MIMEタイプ（拡張子の決定に使用）
 * @returns 安全なファイル名
 *
 * @example
 * ```typescript
 * const safeName = generateSafeFileName('../../etc/passwd.jpg', 'image/jpeg')
 * // => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg'
 * ```
 */
export function generateSafeFileName(
  originalName: string,
  mimeType: string
): string {
  // MIMEタイプから拡張子を決定
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
  }

  const extension = extensionMap[mimeType] || 'bin'

  // UUIDを生成（crypto.randomUUIDはNode.js 14.17+で利用可能）
  const uuid = crypto.randomUUID()

  return `${uuid}.${extension}`
}

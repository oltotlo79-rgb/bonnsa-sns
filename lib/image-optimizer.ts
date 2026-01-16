// 画像最適化ユーティリティ
// Sharpがインストールされている場合は使用、なければパススルー

interface OptimizeOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png' | 'avif'
}

interface OptimizeResult {
  buffer: Buffer
  format: string
  width: number
  height: number
  originalSize: number
  optimizedSize: number
}

// Sharpが利用可能かチェック
let sharp: typeof import('sharp') | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharp = require('sharp')
} catch {
  console.log('Sharp not available, image optimization disabled')
}

/**
 * 画像を最適化する
 */
export async function optimizeImage(
  input: Buffer | ArrayBuffer | Uint8Array,
  options: OptimizeOptions = {}
): Promise<OptimizeResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 80,
    format = 'webp',
  } = options

  // 入力をBufferに変換
  let inputBuffer: Buffer
  if (Buffer.isBuffer(input)) {
    inputBuffer = input
  } else if (input instanceof ArrayBuffer) {
    inputBuffer = Buffer.from(new Uint8Array(input))
  } else {
    inputBuffer = Buffer.from(input)
  }
  const originalSize = inputBuffer.length

  // Sharpが利用できない場合はパススルー
  if (!sharp) {
    return {
      buffer: inputBuffer,
      format: 'original',
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize,
    }
  }

  try {
    let image = sharp(inputBuffer)

    // メタデータを取得
    const metadata = await image.metadata()
    let width = metadata.width || 0
    let height = metadata.height || 0

    // リサイズが必要かチェック
    if (width > maxWidth || height > maxHeight) {
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })

      // リサイズ後のサイズを計算
      const aspectRatio = width / height
      if (width > height) {
        width = Math.min(width, maxWidth)
        height = Math.round(width / aspectRatio)
      } else {
        height = Math.min(height, maxHeight)
        width = Math.round(height * aspectRatio)
      }
    }

    // フォーマット変換と圧縮
    let outputBuffer: Buffer

    switch (format) {
      case 'webp':
        outputBuffer = await image.webp({ quality }).toBuffer()
        break
      case 'avif':
        outputBuffer = await image.avif({ quality }).toBuffer()
        break
      case 'jpeg':
        outputBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer()
        break
      case 'png':
        outputBuffer = await image.png({ compressionLevel: 9 }).toBuffer()
        break
      default:
        outputBuffer = await image.webp({ quality }).toBuffer()
    }

    return {
      buffer: outputBuffer,
      format,
      width,
      height,
      originalSize,
      optimizedSize: outputBuffer.length,
    }
  } catch (error) {
    console.error('Image optimization error:', error)
    // エラー時は元の画像を返す
    return {
      buffer: inputBuffer,
      format: 'original',
      width: 0,
      height: 0,
      originalSize,
      optimizedSize: originalSize,
    }
  }
}

/**
 * サムネイル用に画像をリサイズ
 */
export async function createThumbnail(
  input: Buffer | ArrayBuffer | Uint8Array,
  size: number = 200
): Promise<Buffer> {
  let inputBuffer: Buffer
  if (Buffer.isBuffer(input)) {
    inputBuffer = input
  } else if (input instanceof ArrayBuffer) {
    inputBuffer = Buffer.from(new Uint8Array(input))
  } else {
    inputBuffer = Buffer.from(input)
  }

  if (!sharp) {
    return inputBuffer
  }

  try {
    return await sharp(inputBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 70 })
      .toBuffer()
  } catch (error) {
    console.error('Thumbnail creation error:', error)
    return inputBuffer
  }
}

/**
 * 画像のメタデータを取得
 */
export async function getImageMetadata(
  input: Buffer | ArrayBuffer | Uint8Array
): Promise<{
  width: number
  height: number
  format: string
  size: number
} | null> {
  let inputBuffer: Buffer
  if (Buffer.isBuffer(input)) {
    inputBuffer = input
  } else if (input instanceof ArrayBuffer) {
    inputBuffer = Buffer.from(new Uint8Array(input))
  } else {
    inputBuffer = Buffer.from(input)
  }

  if (!sharp) {
    return {
      width: 0,
      height: 0,
      format: 'unknown',
      size: inputBuffer.length,
    }
  }

  try {
    const metadata = await sharp(inputBuffer).metadata()
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: inputBuffer.length,
    }
  } catch (error) {
    console.error('Metadata extraction error:', error)
    return null
  }
}

/**
 * 画像フォーマットに対応するMIMEタイプを取得
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
  }
  return mimeTypes[format.toLowerCase()] || 'application/octet-stream'
}

/**
 * Sharpが利用可能かどうか
 */
export function isSharpAvailable(): boolean {
  return sharp !== null
}

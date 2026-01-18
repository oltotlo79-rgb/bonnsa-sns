/**
 * 画像最適化ユーティリティ
 *
 * このファイルは、アップロードされた画像の最適化機能を提供します。
 * ファイルサイズの削減、フォーマット変換、リサイズを行います。
 *
 * ## 画像最適化の目的
 *
 * ### 1. ストレージコストの削減
 * - 画像サイズを圧縮してストレージ使用量を削減
 * - 例: 5MB → 500KB（90%削減）
 *
 * ### 2. 読み込み速度の向上
 * - 小さいファイルは高速にダウンロード
 * - ユーザー体験の向上
 *
 * ### 3. 帯域幅の節約
 * - サーバーとユーザー両方の帯域幅を節約
 *
 * ## Sharp ライブラリ
 * Node.js向けの高速画像処理ライブラリ。
 * libvipsを使用しており、非常に高速です。
 *
 * ## グレースフルデグラデーション
 * Sharpがインストールされていない環境でも動作します。
 * その場合、画像は最適化されずにそのまま返されます。
 *
 * @module lib/image-optimizer
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * エラー発生時や処理完了時のログ出力に使用
 */
import logger from '@/lib/logger'

// ============================================================
// 型定義
// ============================================================

/**
 * 画像最適化オプションの型
 *
 * ## 各プロパティの説明
 *
 * ### maxWidth / maxHeight
 * 画像の最大寸法（ピクセル）
 * この値を超える画像は縮小されます
 *
 * ### quality
 * 圧縮品質（1-100）
 * 低いほどファイルサイズは小さくなりますが、
 * 画質も低下します
 *
 * ### format
 * 出力フォーマット
 * - webp: 高圧縮率、広くサポート
 * - avif: 最高の圧縮率、サポートは限定的
 * - jpeg: 互換性が高い
 * - png: 透過対応、可逆圧縮
 */
interface OptimizeOptions {
  maxWidth?: number      // 最大幅
  maxHeight?: number     // 最大高さ
  quality?: number       // 品質（1-100）
  format?: 'webp' | 'jpeg' | 'png' | 'avif'  // 出力形式
}

/**
 * 画像最適化結果の型
 *
 * ## 各プロパティの説明
 *
 * ### buffer
 * 最適化後の画像データ
 *
 * ### format
 * 実際に適用されたフォーマット
 * Sharpが使用できない場合は 'original'
 *
 * ### width / height
 * 最適化後の寸法
 * Sharpが使用できない場合は 0
 *
 * ### originalSize / optimizedSize
 * 元のサイズと最適化後のサイズ（バイト）
 * 圧縮率の計算に使用
 */
interface OptimizeResult {
  buffer: Buffer         // 最適化後の画像データ
  format: string         // 出力形式
  width: number          // 幅
  height: number         // 高さ
  originalSize: number   // 元のサイズ
  optimizedSize: number  // 最適化後のサイズ
}

// ============================================================
// Sharp ライブラリの動的読み込み
// ============================================================

/**
 * Sharpライブラリのインスタンス
 *
 * ## なぜ動的読み込みか？
 *
 * ### 1. オプショナル依存
 * Sharpはネイティブモジュールを含むため、
 * 一部の環境（Cloudflare Workers等）では
 * インストールできない場合があります
 *
 * ### 2. ビルドエラー回避
 * 静的インポートだと、Sharpがない環境で
 * ビルドエラーになります
 *
 * ### 3. グレースフルデグラデーション
 * Sharpがなくても動作を継続できます
 */
let sharp: typeof import('sharp') | null = null

try {
  /**
   * require()による動的読み込み
   *
   * try-catchでエラーをキャッチし、
   * 失敗した場合はnullのまま続行
   *
   * eslint-disable-next-line: require()を使うため必要
   */
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharp = require('sharp')
} catch {
  logger.log('Sharp not available, image optimization disabled')
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 画像を最適化する
 *
 * ## 機能概要
 * 画像をリサイズ、フォーマット変換、圧縮して最適化します。
 *
 * ## パラメータ
 * @param input - 元の画像データ（Buffer, ArrayBuffer, Uint8Array）
 * @param options - 最適化オプション
 *
 * ## 戻り値
 * @returns Promise<OptimizeResult> - 最適化結果
 *
 * ## デフォルト値
 * - maxWidth: 1920px
 * - maxHeight: 1080px
 * - quality: 80
 * - format: webp
 *
 * ## 処理フロー
 * 1. 入力をBufferに変換
 * 2. Sharpが使えない場合はそのまま返す
 * 3. メタデータ（寸法）を取得
 * 4. 必要に応じてリサイズ
 * 5. フォーマット変換と圧縮
 *
 * ## 使用例
 * ```typescript
 * const result = await optimizeImage(fileBuffer, {
 *   maxWidth: 800,
 *   quality: 85,
 *   format: 'webp'
 * })
 *
 * console.log(`Reduced: ${result.originalSize} → ${result.optimizedSize}`)
 * ```
 */
export async function optimizeImage(
  input: Buffer | ArrayBuffer | Uint8Array,
  options: OptimizeOptions = {}
): Promise<OptimizeResult> {
  /**
   * オプションのデフォルト値設定
   *
   * 分割代入でデフォルト値を指定
   */
  const {
    maxWidth = 1920,    // Full HD幅
    maxHeight = 1080,   // Full HD高さ
    quality = 80,       // 高品質
    format = 'webp',    // WebP形式（良バランス）
  } = options

  /**
   * 入力をBufferに変換
   *
   * 様々な形式の入力を統一的に扱うための変換処理
   * - Buffer: そのまま使用
   * - ArrayBuffer: Uint8Arrayに変換してからBufferに
   * - Uint8Array: 直接Bufferに
   */
  let inputBuffer: Buffer
  if (Buffer.isBuffer(input)) {
    inputBuffer = input
  } else if (input instanceof ArrayBuffer) {
    inputBuffer = Buffer.from(new Uint8Array(input))
  } else {
    inputBuffer = Buffer.from(input)
  }
  const originalSize = inputBuffer.length

  /**
   * Sharpが利用できない場合はパススルー
   *
   * 元の画像をそのまま返す（最適化なし）
   */
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
    /**
     * Sharpインスタンスの作成
     *
     * sharp(buffer)で画像処理パイプラインを開始
     */
    let image = sharp(inputBuffer)

    /**
     * メタデータを取得
     *
     * 元の画像の寸法やフォーマットを取得
     */
    const metadata = await image.metadata()
    let width = metadata.width || 0
    let height = metadata.height || 0

    /**
     * リサイズが必要かチェック
     *
     * 元画像が最大寸法を超えている場合のみリサイズ
     */
    if (width > maxWidth || height > maxHeight) {
      /**
       * リサイズ処理
       *
       * fit: 'inside' - アスペクト比を維持しつつ、
       *                 指定サイズ内に収まるようにリサイズ
       * withoutEnlargement: true - 元より大きくしない
       */
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })

      /**
       * リサイズ後のサイズを計算
       *
       * アスペクト比を維持してサイズを再計算
       */
      const aspectRatio = width / height
      if (width > height) {
        // 横長画像
        width = Math.min(width, maxWidth)
        height = Math.round(width / aspectRatio)
      } else {
        // 縦長画像
        height = Math.min(height, maxHeight)
        width = Math.round(height * aspectRatio)
      }
    }

    /**
     * フォーマット変換と圧縮
     *
     * 指定されたフォーマットに変換し、品質を設定
     */
    let outputBuffer: Buffer

    switch (format) {
      case 'webp':
        /**
         * WebP形式
         *
         * - 高い圧縮率
         * - 幅広いブラウザサポート
         * - 透過対応
         */
        outputBuffer = await image.webp({ quality }).toBuffer()
        break
      case 'avif':
        /**
         * AVIF形式
         *
         * - 最高の圧縮率
         * - 新しいフォーマット
         * - ブラウザサポートは限定的
         */
        outputBuffer = await image.avif({ quality }).toBuffer()
        break
      case 'jpeg':
        /**
         * JPEG形式
         *
         * - 広い互換性
         * - mozjpeg: true で最適化アルゴリズム使用
         */
        outputBuffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer()
        break
      case 'png':
        /**
         * PNG形式
         *
         * - 可逆圧縮
         * - 透過対応
         * - compressionLevel: 9 で最高圧縮
         */
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
    /**
     * エラー処理
     *
     * 最適化に失敗した場合は元の画像を返す
     * サービスを止めないためのフォールバック
     */
    logger.error('Image optimization error:', error)
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
 *
 * ## 機能概要
 * プロフィール画像などのサムネイル用に、
 * 正方形にトリミングしてリサイズします。
 *
 * ## パラメータ
 * @param input - 元の画像データ
 * @param size - サムネイルのサイズ（デフォルト: 200px）
 *
 * ## 戻り値
 * @returns Promise<Buffer> - サムネイル画像データ
 *
 * ## 処理内容
 * - 正方形にトリミング（中央基準）
 * - 指定サイズにリサイズ
 * - WebP形式に変換（品質70%）
 *
 * ## 使用例
 * ```typescript
 * const thumbnail = await createThumbnail(avatarBuffer, 150)
 * // 150x150px の正方形サムネイルを生成
 * ```
 */
export async function createThumbnail(
  input: Buffer | ArrayBuffer | Uint8Array,
  size: number = 200
): Promise<Buffer> {
  /**
   * 入力をBufferに変換
   */
  let inputBuffer: Buffer
  if (Buffer.isBuffer(input)) {
    inputBuffer = input
  } else if (input instanceof ArrayBuffer) {
    inputBuffer = Buffer.from(new Uint8Array(input))
  } else {
    inputBuffer = Buffer.from(input)
  }

  /**
   * Sharpが使えない場合はそのまま返す
   */
  if (!sharp) {
    return inputBuffer
  }

  try {
    /**
     * サムネイル生成
     *
     * fit: 'cover' - アスペクト比を維持せず、
     *                指定サイズで切り取り
     * position: 'center' - 中央を基準にトリミング
     */
    return await sharp(inputBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 70 })  // 少し低めの品質でファイルサイズ削減
      .toBuffer()
  } catch (error) {
    logger.error('Thumbnail creation error:', error)
    return inputBuffer
  }
}

/**
 * 画像のメタデータを取得
 *
 * ## 機能概要
 * 画像の寸法、フォーマット、サイズを取得します。
 *
 * ## パラメータ
 * @param input - 画像データ
 *
 * ## 戻り値
 * @returns メタデータオブジェクト、またはnull（取得失敗時）
 *
 * ## 使用例
 * ```typescript
 * const metadata = await getImageMetadata(imageBuffer)
 * if (metadata) {
 *   console.log(`サイズ: ${metadata.width}x${metadata.height}`)
 *   console.log(`形式: ${metadata.format}`)
 * }
 * ```
 */
export async function getImageMetadata(
  input: Buffer | ArrayBuffer | Uint8Array
): Promise<{
  width: number
  height: number
  format: string
  size: number
} | null> {
  /**
   * 入力をBufferに変換
   */
  let inputBuffer: Buffer
  if (Buffer.isBuffer(input)) {
    inputBuffer = input
  } else if (input instanceof ArrayBuffer) {
    inputBuffer = Buffer.from(new Uint8Array(input))
  } else {
    inputBuffer = Buffer.from(input)
  }

  /**
   * Sharpが使えない場合は限定的な情報のみ返す
   */
  if (!sharp) {
    return {
      width: 0,
      height: 0,
      format: 'unknown',
      size: inputBuffer.length,
    }
  }

  try {
    /**
     * Sharpでメタデータを取得
     */
    const metadata = await sharp(inputBuffer).metadata()
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: inputBuffer.length,
    }
  } catch (error) {
    logger.error('Metadata extraction error:', error)
    return null
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 画像フォーマットに対応するMIMEタイプを取得
 *
 * ## 機能概要
 * フォーマット名からMIMEタイプを返します。
 *
 * ## パラメータ
 * @param format - フォーマット名（webp, jpeg等）
 *
 * ## 戻り値
 * @returns string - MIMEタイプ
 *
 * ## MIMEタイプとは？
 * ファイルの種類を示す標準的な識別子。
 * HTTPヘッダーで使用されます。
 *
 * ## 使用例
 * ```typescript
 * const mimeType = getMimeType('webp')
 * // 'image/webp'
 * ```
 */
export function getMimeType(format: string): string {
  /**
   * フォーマットとMIMEタイプのマッピング
   */
  const mimeTypes: Record<string, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',    // jpegの別名
    png: 'image/png',
    gif: 'image/gif',
  }

  /**
   * 小文字に変換してマッチング
   *
   * 見つからない場合は汎用的なバイナリタイプを返す
   */
  return mimeTypes[format.toLowerCase()] || 'application/octet-stream'
}

/**
 * Sharpが利用可能かどうかをチェック
 *
 * ## 機能概要
 * Sharpライブラリが使用可能な状態かを返します。
 *
 * ## 戻り値
 * @returns boolean - 利用可能ならtrue
 *
 * ## 使用例
 * ```typescript
 * if (isSharpAvailable()) {
 *   // 最適化を実行
 * } else {
 *   // 代替処理
 * }
 * ```
 */
export function isSharpAvailable(): boolean {
  return sharp !== null
}

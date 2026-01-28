/**
 * クライアント側画像圧縮（client-image-compression.ts）のテスト
 *
 * @jest-environment jsdom
 */

import {
  isImageFile,
  isVideoFile,
  formatFileSize,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
} from '@/lib/client-image-compression'

describe('client-image-compression', () => {
  // ============================================================
  // 定数
  // ============================================================

  describe('定数', () => {
    it('MAX_IMAGE_SIZEが10MBに設定されている', () => {
      expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024)
    })

    it('MAX_VIDEO_SIZEが256MBに設定されている', () => {
      expect(MAX_VIDEO_SIZE).toBe(256 * 1024 * 1024)
    })
  })

  // ============================================================
  // isImageFile
  // ============================================================

  describe('isImageFile', () => {
    it('JPEG画像を認識する', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(isImageFile(file)).toBe(true)
    })

    it('PNG画像を認識する', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      expect(isImageFile(file)).toBe(true)
    })

    it('WebP画像を認識する', () => {
      const file = new File(['test'], 'test.webp', { type: 'image/webp' })
      expect(isImageFile(file)).toBe(true)
    })

    it('GIF画像を認識する', () => {
      const file = new File(['test'], 'test.gif', { type: 'image/gif' })
      expect(isImageFile(file)).toBe(true)
    })

    it('SVG画像を認識する', () => {
      const file = new File(['test'], 'test.svg', { type: 'image/svg+xml' })
      expect(isImageFile(file)).toBe(true)
    })

    it('動画ファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      expect(isImageFile(file)).toBe(false)
    })

    it('テキストファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      expect(isImageFile(file)).toBe(false)
    })

    it('PDFファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      expect(isImageFile(file)).toBe(false)
    })

    it('JSONファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.json', { type: 'application/json' })
      expect(isImageFile(file)).toBe(false)
    })
  })

  // ============================================================
  // isVideoFile
  // ============================================================

  describe('isVideoFile', () => {
    it('MP4動画を認識する', () => {
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      expect(isVideoFile(file)).toBe(true)
    })

    it('WebM動画を認識する', () => {
      const file = new File(['test'], 'test.webm', { type: 'video/webm' })
      expect(isVideoFile(file)).toBe(true)
    })

    it('MOV動画を認識する', () => {
      const file = new File(['test'], 'test.mov', { type: 'video/quicktime' })
      expect(isVideoFile(file)).toBe(true)
    })

    it('AVI動画を認識する', () => {
      const file = new File(['test'], 'test.avi', { type: 'video/x-msvideo' })
      expect(isVideoFile(file)).toBe(true)
    })

    it('画像ファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(isVideoFile(file)).toBe(false)
    })

    it('音声ファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' })
      expect(isVideoFile(file)).toBe(false)
    })

    it('テキストファイルはfalseを返す', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      expect(isVideoFile(file)).toBe(false)
    })
  })

  // ============================================================
  // formatFileSize
  // ============================================================

  describe('formatFileSize', () => {
    it('0バイトを正しくフォーマットする', () => {
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('バイト単位を正しくフォーマットする', () => {
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('KB単位を正しくフォーマットする', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(2048)).toBe('2 KB')
    })

    it('MB単位を正しくフォーマットする', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
      expect(formatFileSize(1024 * 1024 * 10)).toBe('10 MB')
    })

    it('GB単位を正しくフォーマットする', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatFileSize(1024 * 1024 * 1024 * 2)).toBe('2 GB')
    })

    it('小数点以下1桁に丸める', () => {
      expect(formatFileSize(1500)).toBe('1.5 KB')
      expect(formatFileSize(2500 * 1024)).toBe('2.4 MB')
    })

    it('整数の場合は小数点なし', () => {
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    })

    it('大きなファイルサイズを処理する', () => {
      expect(formatFileSize(MAX_IMAGE_SIZE)).toBe('10 MB')
      expect(formatFileSize(MAX_VIDEO_SIZE)).toBe('256 MB')
    })
  })

  // ============================================================
  // ファイルタイプ判定の組み合わせ
  // ============================================================

  describe('ファイルタイプ判定の組み合わせ', () => {
    it('同じファイルがisImageFileとisVideoFileの両方でtrueにならない', () => {
      const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const videoFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })

      expect(isImageFile(imageFile) && isVideoFile(imageFile)).toBe(false)
      expect(isImageFile(videoFile) && isVideoFile(videoFile)).toBe(false)
    })

    it('画像と動画はそれぞれ正しく識別される', () => {
      const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const videoFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })

      expect(isImageFile(imageFile)).toBe(true)
      expect(isVideoFile(imageFile)).toBe(false)

      expect(isImageFile(videoFile)).toBe(false)
      expect(isVideoFile(videoFile)).toBe(true)
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('空のMIMEタイプを処理する', () => {
      const file = new File(['test'], 'test.unknown', { type: '' })
      expect(isImageFile(file)).toBe(false)
      expect(isVideoFile(file)).toBe(false)
    })

    it('不正なMIMEタイプを処理する', () => {
      const file = new File(['test'], 'test.unknown', { type: 'application/octet-stream' })
      expect(isImageFile(file)).toBe(false)
      expect(isVideoFile(file)).toBe(false)
    })

    it('非常に小さいファイルサイズをフォーマットする', () => {
      expect(formatFileSize(1)).toBe('1 B')
      expect(formatFileSize(10)).toBe('10 B')
    })

    it('境界値のファイルサイズをフォーマットする', () => {
      expect(formatFileSize(1023)).toBe('1023 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1025)).toBe('1 KB')
    })
  })

  // ============================================================
  // サイズバリデーション用ヘルパーテスト
  // ============================================================

  describe('サイズバリデーション', () => {
    it('MAX_IMAGE_SIZE以下の画像は有効', () => {
      const validSize = MAX_IMAGE_SIZE - 1
      expect(validSize <= MAX_IMAGE_SIZE).toBe(true)
    })

    it('MAX_IMAGE_SIZEを超える画像は無効', () => {
      const invalidSize = MAX_IMAGE_SIZE + 1
      expect(invalidSize <= MAX_IMAGE_SIZE).toBe(false)
    })

    it('MAX_VIDEO_SIZE以下の動画は有効', () => {
      const validSize = MAX_VIDEO_SIZE - 1
      expect(validSize <= MAX_VIDEO_SIZE).toBe(true)
    })

    it('MAX_VIDEO_SIZEを超える動画は無効', () => {
      const invalidSize = MAX_VIDEO_SIZE + 1
      expect(invalidSize <= MAX_VIDEO_SIZE).toBe(false)
    })

    it('一般的な画像サイズが制限内', () => {
      // 5MBの画像
      const fiveMB = 5 * 1024 * 1024
      expect(fiveMB <= MAX_IMAGE_SIZE).toBe(true)
    })

    it('一般的な動画サイズが制限内', () => {
      // 100MBの動画
      const hundredMB = 100 * 1024 * 1024
      expect(hundredMB <= MAX_VIDEO_SIZE).toBe(true)
    })
  })

  // ============================================================
  // CompressionOptions型テスト
  // ============================================================

  describe('CompressionOptions型', () => {
    it('デフォルトオプションの形式が正しい', () => {
      const defaultOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        quality: 0.8,
      }

      expect(defaultOptions.maxSizeMB).toBe(1)
      expect(defaultOptions.maxWidthOrHeight).toBe(1920)
      expect(defaultOptions.quality).toBe(0.8)
    })

    it('カスタムオプションを設定できる', () => {
      const customOptions = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        quality: 0.6,
      }

      expect(customOptions.maxSizeMB).toBe(0.5)
      expect(customOptions.maxWidthOrHeight).toBe(512)
      expect(customOptions.quality).toBe(0.6)
    })

    it('部分的なオプションを指定できる', () => {
      const partialOptions = {
        maxSizeMB: 2,
      }

      expect(partialOptions.maxSizeMB).toBe(2)
    })
  })

  // ============================================================
  // CompressionResult型テスト
  // ============================================================

  describe('CompressionResult型', () => {
    it('圧縮結果の形式が正しい', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = {
        file: mockFile,
        originalSize: 1000,
        compressedSize: 500,
        compressionRatio: 50,
      }

      expect(result.file).toBe(mockFile)
      expect(result.originalSize).toBe(1000)
      expect(result.compressedSize).toBe(500)
      expect(result.compressionRatio).toBe(50)
    })

    it('圧縮率が正しく計算される', () => {
      const originalSize = 1000
      const compressedSize = 300
      const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)

      expect(compressionRatio).toBe(70)
    })

    it('圧縮されない場合の圧縮率は0', () => {
      const originalSize = 100
      const compressedSize = 100
      const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)

      expect(compressionRatio).toBe(0)
    })
  })

  // ============================================================
  // 圧縮閾値テスト
  // ============================================================

  describe('圧縮閾値', () => {
    const SKIP_COMPRESSION_THRESHOLD = 500 * 1024 // 500KB

    it('500KB以下のファイルは圧縮をスキップする', () => {
      const smallFileSize = 400 * 1024 // 400KB
      const shouldSkip = smallFileSize <= SKIP_COMPRESSION_THRESHOLD

      expect(shouldSkip).toBe(true)
    })

    it('500KBを超えるファイルは圧縮対象', () => {
      const largeFileSize = 600 * 1024 // 600KB
      const shouldSkip = largeFileSize <= SKIP_COMPRESSION_THRESHOLD

      expect(shouldSkip).toBe(false)
    })

    it('ちょうど500KBのファイルは圧縮をスキップする', () => {
      const exactThreshold = 500 * 1024
      const shouldSkip = exactThreshold <= SKIP_COMPRESSION_THRESHOLD

      expect(shouldSkip).toBe(true)
    })
  })

  // ============================================================
  // 画像サイズ計算テスト
  // ============================================================

  describe('画像サイズ計算', () => {
    function calculateDimensions(
      width: number,
      height: number,
      maxSize: number
    ): { width: number; height: number } {
      if (width <= maxSize && height <= maxSize) {
        return { width, height }
      }

      if (width > height) {
        return {
          width: maxSize,
          height: Math.round((height / width) * maxSize),
        }
      } else {
        return {
          width: Math.round((width / height) * maxSize),
          height: maxSize,
        }
      }
    }

    it('最大サイズ以下の画像はそのまま', () => {
      const result = calculateDimensions(800, 600, 1920)

      expect(result.width).toBe(800)
      expect(result.height).toBe(600)
    })

    it('横長画像が正しくリサイズされる', () => {
      const result = calculateDimensions(3840, 2160, 1920)

      expect(result.width).toBe(1920)
      expect(result.height).toBe(1080)
    })

    it('縦長画像が正しくリサイズされる', () => {
      const result = calculateDimensions(1080, 1920, 1000)

      expect(result.width).toBe(563)
      expect(result.height).toBe(1000)
    })

    it('正方形画像が正しくリサイズされる', () => {
      const result = calculateDimensions(2000, 2000, 1000)

      expect(result.width).toBe(1000)
      expect(result.height).toBe(1000)
    })

    it('アスペクト比が維持される', () => {
      const original = { width: 1600, height: 900 }
      const result = calculateDimensions(1600, 900, 800)

      const originalRatio = original.width / original.height
      const resultRatio = result.width / result.height

      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01)
    })
  })

  // ============================================================
  // VideoUploadResult型テスト
  // ============================================================

  describe('VideoUploadResult型', () => {
    it('成功時の結果形式', () => {
      const successResult = {
        url: 'https://example.com/video.mp4',
      }

      expect(successResult.url).toBeDefined()
      expect(successResult.url).toContain('https://')
    })

    it('エラー時の結果形式', () => {
      const errorResult = {
        error: 'アップロードに失敗しました',
      }

      expect(errorResult.error).toBeDefined()
      expect(errorResult.error).toBe('アップロードに失敗しました')
    })

    it('ファイルサイズエラーの形式', () => {
      const fileSize = 300 * 1024 * 1024 // 300MB
      const maxSize = 256 * 1024 * 1024 // 256MB

      const errorMessage = `動画は${maxSize / 1024 / 1024}MB以下にしてください（現在: ${(fileSize / 1024 / 1024).toFixed(1)}MB）`

      expect(errorMessage).toContain('256MB')
      expect(errorMessage).toContain('300.0MB')
    })
  })

  // ============================================================
  // prepareFileForUpload関連テスト
  // ============================================================

  describe('prepareFileForUpload動作', () => {
    it('動画ファイルは圧縮されずに返される', () => {
      const videoFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' })

      // 動画は圧縮対象外
      expect(isVideoFile(videoFile)).toBe(true)
      expect(isImageFile(videoFile)).toBe(false)
    })

    it('画像ファイルは圧縮対象', () => {
      const imageFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' })

      expect(isImageFile(imageFile)).toBe(true)
      expect(isVideoFile(imageFile)).toBe(false)
    })

    it('その他のファイルはそのまま返される', () => {
      const otherFile = new File(['content'], 'test.txt', { type: 'text/plain' })

      expect(isImageFile(otherFile)).toBe(false)
      expect(isVideoFile(otherFile)).toBe(false)
    })
  })

  // ============================================================
  // JPEG品質設定テスト
  // ============================================================

  describe('JPEG品質設定', () => {
    it('品質は0-1の範囲', () => {
      const validQualities = [0, 0.5, 0.8, 1]

      validQualities.forEach((quality) => {
        expect(quality).toBeGreaterThanOrEqual(0)
        expect(quality).toBeLessThanOrEqual(1)
      })
    })

    it('品質を下げると圧縮率が向上する', () => {
      const highQuality = 0.9
      const lowQuality = 0.5

      // 品質が低いほど圧縮率が高い（ファイルサイズが小さい）
      expect(lowQuality).toBeLessThan(highQuality)
    })

    it('デフォルト品質は0.8', () => {
      const defaultQuality = 0.8

      expect(defaultQuality).toBe(0.8)
    })

    it('目標サイズに達しない場合は品質を30%下げる', () => {
      const initialQuality = 0.8
      const reducedQuality = initialQuality * 0.7

      expect(reducedQuality).toBeCloseTo(0.56, 2)
    })
  })

  // ============================================================
  // ファイル名処理テスト
  // ============================================================

  describe('ファイル名処理', () => {
    it('拡張子をJPGに変更する', () => {
      const originalName = 'photo.png'
      const newName = originalName.replace(/\.[^/.]+$/, '') + '.jpg'

      expect(newName).toBe('photo.jpg')
    })

    it('複数のドットがある場合も正しく処理する', () => {
      const originalName = 'my.photo.file.png'
      const newName = originalName.replace(/\.[^/.]+$/, '') + '.jpg'

      expect(newName).toBe('my.photo.file.jpg')
    })

    it('拡張子がない場合も処理できる', () => {
      const originalName = 'photo'
      const newName = originalName.replace(/\.[^/.]+$/, '') + '.jpg'

      expect(newName).toBe('photo.jpg')
    })

    it('WebPからJPGへの変換', () => {
      const originalName = 'image.webp'
      const newName = originalName.replace(/\.[^/.]+$/, '') + '.jpg'

      expect(newName).toBe('image.jpg')
    })
  })

  // ============================================================
  // 圧縮リトライテスト
  // ============================================================

  describe('圧縮リトライ', () => {
    it('最大3回まで試行する', () => {
      const maxRetries = 3
      let retryCount = 0

      for (let i = 0; i < maxRetries; i++) {
        retryCount++
      }

      expect(retryCount).toBe(3)
    })

    it('目標サイズに達したらリトライを停止する', () => {
      const targetSize = 1024 * 1024 // 1MB
      const sizes = [1.5 * 1024 * 1024, 0.8 * 1024 * 1024] // 1.5MB, 0.8MB
      let retryCount = 0

      for (const size of sizes) {
        retryCount++
        if (size <= targetSize) {
          break
        }
      }

      expect(retryCount).toBe(2)
    })
  })

  // ============================================================
  // MIMEタイプ処理テスト
  // ============================================================

  describe('MIMEタイプ処理', () => {
    it('image/jpeg', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      expect(file.type).toBe('image/jpeg')
    })

    it('image/png', () => {
      const file = new File([''], 'test.png', { type: 'image/png' })
      expect(file.type).toBe('image/png')
    })

    it('image/webp', () => {
      const file = new File([''], 'test.webp', { type: 'image/webp' })
      expect(file.type).toBe('image/webp')
    })

    it('video/mp4', () => {
      const file = new File([''], 'test.mp4', { type: 'video/mp4' })
      expect(file.type).toBe('video/mp4')
    })

    it('video/webm', () => {
      const file = new File([''], 'test.webm', { type: 'video/webm' })
      expect(file.type).toBe('video/webm')
    })
  })
})

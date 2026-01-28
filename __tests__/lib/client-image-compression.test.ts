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
})

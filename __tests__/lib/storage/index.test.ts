/**
 * @jest-environment node
 */

// File system mocks
const mockMkdir = jest.fn()
const mockWriteFile = jest.fn()
const mockUnlink = jest.fn()

jest.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}))

// Logger mock
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Azure SDK mock
const mockAzureUpload = jest.fn()
const mockAzureDelete = jest.fn()
const mockCreateIfNotExists = jest.fn()
const mockGetBlockBlobClient = jest.fn()

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn(() => ({
      getContainerClient: jest.fn(() => ({
        createIfNotExists: mockCreateIfNotExists,
        getBlockBlobClient: mockGetBlockBlobClient,
      })),
    })),
  },
}))

// AWS S3 SDK mock
const mockS3Send = jest.fn()

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn((params: Record<string, unknown>) => ({ type: 'put', params })),
  DeleteObjectCommand: jest.fn((params: Record<string, unknown>) => ({ type: 'delete', params })),
}))

// Global fetch mock
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Storage Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    // 環境変数をリセット
    delete process.env.STORAGE_PROVIDER
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY
    delete process.env.AZURE_STORAGE_CONTAINER_NAME
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_STORAGE_BUCKET
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    delete process.env.R2_BUCKET_NAME
    delete process.env.R2_PUBLIC_URL
  })

  describe('Local Storage Provider', () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'local'
    })

    it('ファイルをローカルストレージにアップロードできる', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/^\/uploads\/avatars\/\d+-[a-f0-9]+\.jpg$/)
      expect(mockMkdir).toHaveBeenCalled()
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('ファイルをローカルストレージから削除できる', async () => {
      mockUnlink.mockResolvedValue(undefined)

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('/uploads/avatars/test.jpg')

      expect(result.success).toBe(true)
      expect(mockUnlink).toHaveBeenCalled()
    })

    it('ディレクトリ作成エラー時はエラーを返す', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
    })

    it('ファイル書き込みエラー時はエラーを返す', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockRejectedValue(new Error('Disk full'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'posts'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Disk full')
    })

    it('削除エラー時はエラーを返す', async () => {
      mockUnlink.mockRejectedValue(new Error('File not found'))

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('/uploads/avatars/notexist.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')
    })

    it('PNG画像の拡張子を正しく処理する', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.png',
        'image/png',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.png$/)
    })

    it('WebP画像の拡張子を正しく処理する', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.webp',
        'image/webp',
        'posts'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.webp$/)
    })

    it('GIF画像の拡張子を正しく処理する', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.gif',
        'image/gif',
        'posts'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.gif$/)
    })

    it('不明なMIMEタイプはjpgにフォールバック', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.unknown',
        'application/octet-stream',
        'posts'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.jpg$/)
    })
  })

  describe('Azure Blob Storage Provider', () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'azure'
      process.env.AZURE_STORAGE_ACCOUNT_NAME = 'testaccount'
      process.env.AZURE_STORAGE_ACCOUNT_KEY = 'testkey'
      process.env.AZURE_STORAGE_CONTAINER_NAME = 'testcontainer'
    })

    it('ファイルをAzure Blob Storageにアップロードできる', async () => {
      mockCreateIfNotExists.mockResolvedValue(undefined)
      mockGetBlockBlobClient.mockReturnValue({
        upload: mockAzureUpload.mockResolvedValue(undefined),
        url: 'https://testaccount.blob.core.windows.net/testcontainer/avatars/test.jpg',
      })

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('blob.core.windows.net')
    })

    it('ファイルをAzure Blob Storageから削除できる', async () => {
      mockGetBlockBlobClient.mockReturnValue({
        delete: mockAzureDelete.mockResolvedValue(undefined),
      })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile(
        'https://testaccount.blob.core.windows.net/testcontainer/avatars/test.jpg'
      )

      expect(result.success).toBe(true)
    })

    it('認証情報が未設定の場合はエラーを返す', async () => {
      delete process.env.AZURE_STORAGE_ACCOUNT_NAME
      delete process.env.AZURE_STORAGE_ACCOUNT_KEY

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('アップロードエラー時はエラーを返す', async () => {
      mockCreateIfNotExists.mockResolvedValue(undefined)
      mockGetBlockBlobClient.mockReturnValue({
        upload: mockAzureUpload.mockRejectedValue(new Error('Azure error')),
      })

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Azure error')
    })
  })

  describe('Supabase Storage Provider', () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
      process.env.SUPABASE_STORAGE_BUCKET = 'testbucket'
    })

    it('ファイルをSupabase Storageにアップロードできる', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('supabase.co')
    })

    it('ファイルをSupabase Storageから削除できる', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile(
        'https://test.supabase.co/storage/v1/object/public/testbucket/avatars/test.jpg'
      )

      expect(result.success).toBe(true)
    })

    it('認証情報が未設定の場合はエラーを返す', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('アップロード失敗時はエラーを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Upload failed'),
      })

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Upload failed')
    })

    it('無効なURLの削除はエラーを返す', async () => {
      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://invalid.url/path/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('削除失敗時はエラーを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Delete failed'),
      })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile(
        'https://test.supabase.co/storage/v1/object/public/testbucket/avatars/test.jpg'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Delete failed')
    })
  })

  describe('Cloudflare R2 Storage Provider', () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'test-account-id'
      process.env.R2_ACCESS_KEY_ID = 'test-access-key'
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
      process.env.R2_BUCKET_NAME = 'testbucket'
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com'
    })

    it('ファイルをCloudflare R2にアップロードできる', async () => {
      mockS3Send.mockResolvedValue({})

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('cdn.example.com')
    })

    it('公開URLが未設定の場合はデフォルトURLを使用', async () => {
      delete process.env.R2_PUBLIC_URL
      mockS3Send.mockResolvedValue({})

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('r2.dev')
    })

    it('ファイルをCloudflare R2から削除できる', async () => {
      mockS3Send.mockResolvedValue({})

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://cdn.example.com/avatars/test.jpg')

      expect(result.success).toBe(true)
    })

    it('認証情報が未設定の場合はエラーを返す', async () => {
      delete process.env.R2_ACCESS_KEY_ID

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('アップロードエラー時はエラーを返す', async () => {
      mockS3Send.mockRejectedValue(new Error('R2 error'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('R2 error')
    })

    it('削除エラー時はエラーを返す', async () => {
      mockS3Send.mockRejectedValue(new Error('Delete error'))

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://cdn.example.com/avatars/test.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Delete error')
    })
  })

  describe('Provider Selection', () => {
    it('未設定の場合はローカルプロバイダーを使用', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/^\/uploads\//)
    })

    it('不明なプロバイダー名の場合はローカルにフォールバック', async () => {
      process.env.STORAGE_PROVIDER = 'unknown'
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/^\/uploads\//)
    })
  })
})

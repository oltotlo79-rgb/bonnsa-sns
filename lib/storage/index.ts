/**
 * ストレージ抽象化レイヤー
 * 環境変数に応じて適切なプロバイダーを自動選択
 *
 * - 本番環境 (STORAGE_PROVIDER=supabase): Supabase Storage（Supabase利用時に推奨）
 * - 本番環境 (STORAGE_PROVIDER=r2): Cloudflare R2
 * - 本番環境 (STORAGE_PROVIDER=azure): Azure Blob Storage
 * - 開発環境 (STORAGE_PROVIDER=local または未設定): ローカルファイル保存
 */

import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

// ストレージプロバイダーのインターフェース
interface StorageProvider {
  upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult>
  delete(url: string): Promise<DeleteResult>
}

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  return map[contentType] || '.jpg'
}

// ローカルストレージプロバイダー（開発環境用）
class LocalStorageProvider implements StorageProvider {
  private uploadDir: string

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads')
    console.log('Storage provider initialized: local')
    console.log('Upload directory:', this.uploadDir)
  }

  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      // フォルダ作成
      const folderPath = path.join(this.uploadDir, folder)
      await mkdir(folderPath, { recursive: true })

      // ユニークなファイル名を生成
      const ext = getExtension(contentType)
      const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
      const filePath = path.join(folderPath, uniqueName)

      // ファイル保存
      await writeFile(filePath, file)

      // 公開URL（Next.jsのpublicディレクトリからの相対パス）
      const url = `/uploads/${folder}/${uniqueName}`

      console.log('Local storage upload success:', url)
      return { success: true, url }
    } catch (err) {
      console.error('Local storage upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async delete(url: string): Promise<DeleteResult> {
    try {
      // URLからファイルパスを取得
      const relativePath = url.replace('/uploads/', '')
      const filePath = path.join(this.uploadDir, relativePath)

      await unlink(filePath)
      console.log('Local storage delete success:', url)
      return { success: true }
    } catch (err) {
      console.error('Local storage delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// Azure Blob Storageプロバイダー（本番環境用）
class AzureBlobStorageProvider implements StorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private containerClient: any
  private initialized: boolean = false

  constructor() {
    console.log('Storage provider initialized: azure')
  }

  private async ensureInitialized() {
    if (this.initialized) return

    const { BlobServiceClient } = await import('@azure/storage-blob')

    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads'

    if (!accountName || !accountKey) {
      throw new Error('Azure Storage credentials not configured')
    }

    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = blobServiceClient.getContainerClient(containerName)

    console.log('Azure Blob Storage container:', containerName)
    this.initialized = true
  }

  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      await this.ensureInitialized()

      // コンテナが存在しない場合は作成
      await this.containerClient.createIfNotExists({ access: 'blob' })

      // ユニークなファイル名を生成
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

      const blockBlobClient = this.containerClient.getBlockBlobClient(uniqueName)

      await blockBlobClient.upload(file, file.length, {
        blobHTTPHeaders: { blobContentType: contentType },
      })

      const url = blockBlobClient.url
      console.log('Azure Blob upload success:', url)
      return { success: true, url }
    } catch (err) {
      console.error('Azure Blob upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async delete(url: string): Promise<DeleteResult> {
    try {
      await this.ensureInitialized()

      // URLからBlob名を取得
      const urlObj = new URL(url)
      const blobName = urlObj.pathname.split('/').slice(2).join('/')

      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
      await blockBlobClient.delete()

      console.log('Azure Blob delete success:', url)
      return { success: true }
    } catch (err) {
      console.error('Azure Blob delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// Supabase Storage Provider（Supabase利用時に推奨）
class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string
  private supabaseKey: string
  private bucket: string

  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads'
    console.log('Storage provider initialized: supabase')
  }

  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      // ユニークなファイル名を生成
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${uniqueName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
            'Content-Type': contentType,
          },
          body: new Uint8Array(file),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Supabase upload failed: ${error}`)
      }

      // 公開URLを生成
      const url = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${uniqueName}`

      console.log('Supabase storage upload success:', url)
      return { success: true, url }
    } catch (err) {
      console.error('Supabase storage upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async delete(url: string): Promise<DeleteResult> {
    try {
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      // URLからパスを取得
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)
      if (!pathMatch) {
        throw new Error('Invalid Supabase storage URL')
      }
      const filePath = pathMatch[1]

      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${filePath}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Supabase delete failed: ${error}`)
      }

      console.log('Supabase storage delete success:', url)
      return { success: true }
    } catch (err) {
      console.error('Supabase storage delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// Cloudflare R2 Storage Provider（本番環境推奨・S3互換API）
class CloudflareR2StorageProvider implements StorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client: any = null
  private bucket: string
  private publicUrl: string
  private initialized: boolean = false

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || 'uploads'
    this.publicUrl = process.env.R2_PUBLIC_URL || ''
    console.log('Storage provider initialized: r2')
  }

  private async ensureInitialized() {
    if (this.initialized) return

    const { S3Client } = await import('@aws-sdk/client-s3')

    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials not configured')
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })

    console.log('Cloudflare R2 bucket:', this.bucket)
    this.initialized = true
  }

  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      await this.ensureInitialized()

      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      // ユニークなファイル名を生成
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueName,
        Body: file,
        ContentType: contentType,
      })

      await this.s3Client.send(command)

      // 公開URLを生成
      const url = this.publicUrl
        ? `${this.publicUrl}/${uniqueName}`
        : `https://${this.bucket}.${process.env.R2_ACCOUNT_ID}.r2.dev/${uniqueName}`

      console.log('R2 upload success:', url)
      return { success: true, url }
    } catch (err) {
      console.error('R2 upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async delete(url: string): Promise<DeleteResult> {
    try {
      await this.ensureInitialized()

      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

      // URLからキーを取得
      const urlObj = new URL(url)
      const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.s3Client.send(command)

      console.log('R2 delete success:', url)
      return { success: true }
    } catch (err) {
      console.error('R2 delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// プロバイダーのシングルトンインスタンス
let storageProvider: StorageProvider | null = null

function getStorageProvider(): StorageProvider {
  if (storageProvider) return storageProvider

  const provider = process.env.STORAGE_PROVIDER || 'local'

  switch (provider) {
    case 'supabase':
      storageProvider = new SupabaseStorageProvider()
      break
    case 'r2':
      storageProvider = new CloudflareR2StorageProvider()
      break
    case 'azure':
      storageProvider = new AzureBlobStorageProvider()
      break
    case 'local':
    default:
      storageProvider = new LocalStorageProvider()
      break
  }

  return storageProvider
}

/**
 * ファイルをアップロード
 * @param file ファイルバッファ
 * @param filename 元のファイル名
 * @param contentType MIMEタイプ
 * @param folder 保存先フォルダ（avatars, headers, posts など）
 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string,
  folder: string
): Promise<UploadResult> {
  const provider = getStorageProvider()
  return provider.upload(file, filename, contentType, folder)
}

/**
 * ファイルを削除
 * @param url 削除するファイルのURL
 */
export async function deleteFile(url: string): Promise<DeleteResult> {
  const provider = getStorageProvider()
  return provider.delete(url)
}

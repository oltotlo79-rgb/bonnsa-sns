/**
 * ストレージ抽象化レイヤー
 *
 * このファイルは、ファイルストレージ機能を抽象化し、
 * 複数のストレージプロバイダーを統一的に扱うためのモジュールです。
 *
 * ## なぜ抽象化が必要か？
 *
 * ### 1. 環境による切り替え
 * - 開発環境: ローカルファイルシステム（高速・無料）
 * - 本番環境: クラウドストレージ（スケーラブル・耐障害性）
 * - テスト環境: モックプロバイダー（自動テスト用）
 *
 * ### 2. ベンダーロックインの回避
 * - Azure、AWS S3、Cloudflare R2など、将来の移行が容易
 * - コードの変更なしに環境変数の設定だけで切り替え可能
 *
 * ### 3. 保守性の向上
 * - ストレージ関連のコードが1箇所に集約
 * - バグ修正や機能追加が全体に反映される
 *
 * ## デザインパターン
 *
 * ### Strategy Pattern（ストラテジーパターン）
 * 同じインターフェースを持つ複数の実装を切り替え可能にするパターン。
 * StorageProvider インターフェースを各プロバイダーが実装。
 *
 * ### Singleton Pattern（シングルトンパターン）
 * アプリケーション全体で1つのインスタンスを共有。
 * リソースの無駄遣いを防ぎ、接続の効率化を実現。
 *
 * ## サポートされるプロバイダー
 *
 * | プロバイダー | 用途 | 環境変数 |
 * |-------------|------|----------|
 * | local | 開発環境 | STORAGE_PROVIDER=local |
 * | azure | Azure Blob Storage | STORAGE_PROVIDER=azure |
 * | supabase | Supabase Storage | STORAGE_PROVIDER=supabase |
 * | r2 | Cloudflare R2 | STORAGE_PROVIDER=r2 |
 *
 * @module lib/storage/index
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * mkdir: ディレクトリ作成（再帰的）
 * writeFile: ファイル書き込み
 * unlink: ファイル削除
 *
 * Node.js の fs/promises モジュールから非同期ファイル操作関数をインポート。
 * Promise ベースで async/await が使用可能。
 */
import { mkdir, writeFile, unlink } from 'fs/promises'

/**
 * logger: 環境対応ロギングユーティリティ
 *
 * 開発環境ではコンソールに出力、本番環境では適切なログサービスに出力。
 * ストレージ操作のデバッグやエラー追跡に使用。
 */
import logger from '@/lib/logger'

/**
 * path: ファイルパス操作
 *
 * プラットフォーム間で一貫したパス操作を提供。
 * Windows の \ と Unix の / を自動的に処理。
 */
import path from 'path'

/**
 * crypto: 暗号化ユーティリティ
 *
 * ここでは randomBytes() を使用してユニークなファイル名を生成。
 * 衝突を防ぐためにランダムな16進数文字列を付与。
 */
import crypto from 'crypto'

// ============================================================
// 型定義
// ============================================================

/**
 * アップロード結果の型
 *
 * ## success
 * アップロードが成功したかどうか
 * - true: 成功、url に公開URLが入る
 * - false: 失敗、error にエラーメッセージが入る
 *
 * ## url（オプション）
 * アップロードされたファイルの公開URL
 * 例: https://storage.example.com/uploads/avatars/abc123.jpg
 *
 * ## error（オプション）
 * エラー発生時のメッセージ
 * UI側でユーザーに表示するために使用
 *
 * ## なぜオプショナルか？
 * 成功時は url のみ、失敗時は error のみが設定されるため、
 * どちらもオプショナル（?）としている。
 */
export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * 削除結果の型
 *
 * ## success
 * 削除が成功したかどうか
 *
 * ## error（オプション）
 * エラー発生時のメッセージ
 *
 * アップロード結果より単純（URLは不要なため）
 */
export interface DeleteResult {
  success: boolean
  error?: string
}

/**
 * ストレージプロバイダーのインターフェース
 *
 * ## インターフェースとは？
 * クラスが実装すべきメソッドの「契約」を定義するもの。
 * このインターフェースを実装するクラスは、
 * upload と delete メソッドを必ず持つ必要がある。
 *
 * ## upload メソッド
 * @param file - ファイルのバイナリデータ（Buffer）
 * @param filename - 元のファイル名（参考情報として使用）
 * @param contentType - MIMEタイプ（例: "image/jpeg"）
 * @param folder - 保存先フォルダ（例: "avatars", "posts"）
 *
 * ## delete メソッド
 * @param url - 削除するファイルの公開URL
 *
 * ## 実装クラス
 * - LocalStorageProvider（開発環境）
 * - AzureBlobStorageProvider（Azure）
 * - SupabaseStorageProvider（Supabase）
 * - CloudflareR2StorageProvider（Cloudflare R2）
 */
interface StorageProvider {
  upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult>
  delete(url: string): Promise<DeleteResult>
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * MIMEタイプから拡張子を取得
 *
 * ## 機能概要
 * Content-Type（MIMEタイプ）から適切なファイル拡張子を決定します。
 *
 * ## パラメータ
 * @param contentType - MIMEタイプ（例: "image/jpeg"）
 *
 * ## 戻り値
 * @returns string - ファイル拡張子（例: ".jpg"）
 *
 * ## MIMEタイプとは？
 * ファイルの種類を示すインターネット標準の識別子。
 * 形式: type/subtype
 * - image/jpeg: JPEG画像
 * - image/png: PNG画像
 * - image/webp: WebP画像
 * - image/gif: GIF画像
 *
 * ## なぜ必要か？
 * アップロードされたファイルのContent-Typeから
 * 保存時の拡張子を決定するため。
 * ブラウザはこの拡張子を見てファイルの種類を判断する。
 *
 * ## 使用例
 * ```typescript
 * getExtension('image/jpeg')  // ".jpg"
 * getExtension('image/png')   // ".png"
 * getExtension('text/plain')  // ".jpg" (デフォルト)
 * ```
 */
function getExtension(contentType: string): string {
  /**
   * MIMEタイプと拡張子のマッピングテーブル
   *
   * Record<string, string>: キーと値の両方が文字列の辞書型
   */
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }

  /**
   * マッピングに存在すればその拡張子を返す
   * 存在しなければデフォルトとして .jpg を返す
   *
   * || 演算子: 左辺が undefined/null/'' の場合に右辺を返す
   */
  return map[contentType] || '.jpg'
}

// ============================================================
// ローカルストレージプロバイダー（開発環境用）
// ============================================================

/**
 * ローカルファイルシステムを使用するストレージプロバイダー
 *
 * ## 用途
 * 開発環境でのテスト・デバッグ用。
 * クラウドサービスへの接続なしにファイルアップロード機能をテスト可能。
 *
 * ## 仕組み
 * Next.js の public ディレクトリにファイルを保存。
 * public 配下のファイルは自動的に静的ファイルとして公開される。
 *
 * ## ファイルパス構成
 * ```
 * project-root/
 * └── public/
 *     └── uploads/
 *         ├── avatars/      # プロフィール画像
 *         ├── headers/      # ヘッダー画像
 *         └── posts/        # 投稿画像
 * ```
 *
 * ## URL形式
 * /uploads/avatars/1234567890-abc123.jpg
 * （Next.js が自動的に public ディレクトリから配信）
 *
 * ## 注意点
 * - 本番環境では使用しないこと（スケールしない）
 * - Git にコミットされないよう .gitignore に追加推奨
 * - サーバー再起動でファイルは維持されるが、デプロイでリセット
 */
class LocalStorageProvider implements StorageProvider {
  /**
   * アップロード先のベースディレクトリ
   *
   * process.cwd(): 現在の作業ディレクトリ（プロジェクトルート）
   * 例: /Users/name/project/public/uploads
   */
  private uploadDir: string

  /**
   * コンストラクタ
   *
   * インスタンス生成時にアップロードディレクトリのパスを設定。
   * path.join() でプラットフォーム非依存のパスを生成。
   */
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads')
    logger.log('Storage provider initialized: local')
    logger.log('Upload directory:', this.uploadDir)
  }

  /**
   * ファイルをローカルストレージにアップロード
   *
   * ## 処理フロー
   * 1. 保存先フォルダを作成（既存なら何もしない）
   * 2. ユニークなファイル名を生成
   * 3. ファイルを書き込み
   * 4. 公開URLを返す
   *
   * ## パラメータ
   * @param file - ファイルのバイナリデータ
   * @param filename - 元のファイル名（未使用だが互換性のため）
   * @param contentType - MIMEタイプ
   * @param folder - 保存先サブフォルダ
   *
   * ## 戻り値
   * @returns Promise<UploadResult> - アップロード結果
   */
  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      /**
       * フォルダ作成
       *
       * recursive: true で親ディレクトリも含めて作成
       * 既存の場合はエラーにならない（冪等性）
       */
      const folderPath = path.join(this.uploadDir, folder)
      await mkdir(folderPath, { recursive: true })

      /**
       * ユニークなファイル名を生成
       *
       * 形式: {タイムスタンプ}-{ランダム16文字}.{拡張子}
       * 例: 1642345678901-a1b2c3d4e5f6g7h8.jpg
       *
       * - Date.now(): 衝突を減らすためのタイムスタンプ
       * - crypto.randomBytes(8): 8バイト = 16文字の16進数
       * - 両方を組み合わせて実質的に一意なファイル名を保証
       */
      const ext = getExtension(contentType)
      const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
      const filePath = path.join(folderPath, uniqueName)

      /**
       * ファイル保存
       *
       * Buffer を直接ファイルに書き込み
       */
      await writeFile(filePath, file)

      /**
       * 公開URL（Next.jsのpublicディレクトリからの相対パス）
       *
       * Next.js では public ディレクトリがルートとして扱われる
       * /uploads/... で public/uploads/... にアクセス可能
       */
      const url = `/uploads/${folder}/${uniqueName}`

      logger.log('Local storage upload success:', url)
      return { success: true, url }
    } catch (err) {
      /**
       * エラー処理
       *
       * - ディスク容量不足
       * - 権限エラー
       * - パスが無効
       * などのケースで発生
       */
      logger.error('Local storage upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * ファイルをローカルストレージから削除
   *
   * ## パラメータ
   * @param url - 削除するファイルのURL
   *   例: /uploads/avatars/1234567890-abc123.jpg
   *
   * ## 戻り値
   * @returns Promise<DeleteResult> - 削除結果
   */
  async delete(url: string): Promise<DeleteResult> {
    try {
      /**
       * URLからファイルパスを取得
       *
       * URL: /uploads/avatars/file.jpg
       * → relativePath: avatars/file.jpg
       * → filePath: /path/to/public/uploads/avatars/file.jpg
       */
      const relativePath = url.replace('/uploads/', '')
      const filePath = path.join(this.uploadDir, relativePath)

      /**
       * ファイル削除
       *
       * unlink: ファイルシステムからファイルを削除
       * 存在しない場合はエラーがスローされる
       */
      await unlink(filePath)
      logger.log('Local storage delete success:', url)
      return { success: true }
    } catch (err) {
      /**
       * エラー処理
       *
       * - ファイルが存在しない
       * - 権限エラー
       * などのケースで発生
       */
      logger.error('Local storage delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// ============================================================
// Azure Blob Storage プロバイダー（本番環境用）
// ============================================================

/**
 * Azure Blob Storage を使用するストレージプロバイダー
 *
 * ## Azure Blob Storage とは？
 * Microsoft Azure のオブジェクトストレージサービス。
 * 画像、動画、バックアップなどの非構造化データを保存。
 *
 * ## 料金体系（参考）
 * - ストレージ: 約 ¥2.5/GB/月
 * - 読み取り操作: 約 ¥0.005/10,000リクエスト
 * - 書き込み操作: 約 ¥0.05/10,000リクエスト
 *
 * ## 必要な環境変数
 * - AZURE_STORAGE_ACCOUNT_NAME: ストレージアカウント名
 * - AZURE_STORAGE_ACCOUNT_KEY: アクセスキー
 * - AZURE_STORAGE_CONTAINER_NAME: コンテナ名（デフォルト: uploads）
 *
 * ## 遅延初期化（Lazy Initialization）
 * SDKの読み込みとクライアント初期化を最初の使用時まで遅延。
 * ビルド時や使用しない環境でのエラーを防止。
 *
 * ## URL形式
 * https://{account}.blob.core.windows.net/{container}/{path}
 */
class AzureBlobStorageProvider implements StorageProvider {
  /**
   * Azure Blob Storageのコンテナクライアント
   *
   * eslint-disable-next-line: any型を許可（SDKの型がビルド時に利用不可のため）
   * 遅延初期化されるため、初期値はundefined
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private containerClient: any

  /**
   * 初期化済みフラグ
   *
   * 重複初期化を防ぐためのフラグ
   */
  private initialized: boolean = false

  /**
   * コンストラクタ
   *
   * ロギングのみ行い、実際の初期化は遅延。
   * これにより、Azure SDKが不要な環境でもエラーにならない。
   */
  constructor() {
    logger.log('Storage provider initialized: azure')
  }

  /**
   * 遅延初期化の実行
   *
   * ## 機能概要
   * Azure SDKの動的インポートとクライアントの初期化を行う。
   *
   * ## なぜ遅延初期化か？
   * 1. Azure SDKが大きい（バンドルサイズ削減）
   * 2. ビルド時に環境変数が未設定でもエラーにならない
   * 3. 開発環境でローカルプロバイダー使用時に不要なロードを防止
   *
   * ## 接続文字列の構成
   * Azure Storageへの接続に必要な情報を1つの文字列に含める形式。
   * - Protocol: HTTPS
   * - Account Name: ストレージアカウント名
   * - Account Key: 認証キー
   * - Endpoint Suffix: Azureのドメイン
   */
  private async ensureInitialized() {
    /**
     * 既に初期化済みなら何もしない（冪等性）
     */
    if (this.initialized) return

    /**
     * Azure Storage SDKを動的インポート
     *
     * dynamic import: 実行時にモジュールを読み込む
     * ビルド時ではなく実行時に読み込むため、
     * SDKが未インストールの環境でもビルドは成功する
     */
    const { BlobServiceClient } = await import('@azure/storage-blob')

    /**
     * 環境変数から認証情報を取得
     */
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads'

    /**
     * 認証情報のバリデーション
     */
    if (!accountName || !accountKey) {
      throw new Error('Azure Storage credentials not configured')
    }

    /**
     * 接続文字列の構築
     *
     * 形式: DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=yyy;EndpointSuffix=core.windows.net
     */
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`

    /**
     * クライアントの初期化
     *
     * BlobServiceClient: ストレージアカウント全体を操作
     * ContainerClient: 特定のコンテナ（フォルダ相当）を操作
     */
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = blobServiceClient.getContainerClient(containerName)

    logger.log('Azure Blob Storage container:', containerName)
    this.initialized = true
  }

  /**
   * ファイルをAzure Blob Storageにアップロード
   *
   * ## 処理フロー
   * 1. SDKの遅延初期化
   * 2. コンテナの存在確認・作成
   * 3. ユニークなファイル名を生成
   * 4. Blobにアップロード
   * 5. 公開URLを返す
   *
   * ## Blob HTTPヘッダー
   * blobContentType を設定することで、
   * ブラウザがファイルを正しく認識できる。
   */
  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      await this.ensureInitialized()

      /**
       * コンテナが存在しない場合は作成
       *
       * createIfNotExists: 存在しなければ作成、存在すれば何もしない
       * access: 'blob': 個々のBlobへの匿名アクセスを許可
       *
       * アクセスレベル:
       * - 'blob': Blobのみ公開（URLを知っていればアクセス可能）
       * - 'container': コンテナ内の一覧も公開
       * - private: 認証必須（デフォルト）
       */
      await this.containerClient.createIfNotExists({ access: 'blob' })

      /**
       * ユニークなファイル名を生成
       *
       * フォルダ構造を含めたパスを生成
       * 例: avatars/1642345678901-a1b2c3d4e5f6g7h8.jpg
       */
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

      /**
       * Block Blobクライアントを取得
       *
       * Block Blob: 大きなファイルをブロック単位で管理
       * 画像やドキュメントに最適
       */
      const blockBlobClient = this.containerClient.getBlockBlobClient(uniqueName)

      /**
       * ファイルをアップロード
       *
       * upload(data, length, options):
       * - data: アップロードするデータ
       * - length: データの長さ（バイト）
       * - options: HTTPヘッダーなどの設定
       */
      await blockBlobClient.upload(file, file.length, {
        blobHTTPHeaders: { blobContentType: contentType },
      })

      /**
       * 公開URLを取得
       *
       * 形式: https://{account}.blob.core.windows.net/{container}/{path}
       */
      const url = blockBlobClient.url
      logger.log('Azure Blob upload success:', url)
      return { success: true, url }
    } catch (err) {
      logger.error('Azure Blob upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * ファイルをAzure Blob Storageから削除
   *
   * ## URLからBlob名を抽出
   * URL: https://account.blob.core.windows.net/container/folder/file.jpg
   * → Blob名: folder/file.jpg
   *
   * pathname: /container/folder/file.jpg
   * slice(2): ["folder", "file.jpg"]
   * join('/'): "folder/file.jpg"
   */
  async delete(url: string): Promise<DeleteResult> {
    try {
      await this.ensureInitialized()

      /**
       * URLからBlob名を取得
       *
       * URL構造:
       * https://account.blob.core.windows.net/container/path/to/file.jpg
       * pathname: /container/path/to/file.jpg
       * split('/').slice(2): ['path', 'to', 'file.jpg']
       * join('/'): 'path/to/file.jpg'
       */
      const urlObj = new URL(url)
      const blobName = urlObj.pathname.split('/').slice(2).join('/')

      /**
       * Blobを削除
       */
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName)
      await blockBlobClient.delete()

      logger.log('Azure Blob delete success:', url)
      return { success: true }
    } catch (err) {
      logger.error('Azure Blob delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// ============================================================
// Supabase Storage プロバイダー
// ============================================================

/**
 * Supabase Storage を使用するストレージプロバイダー
 *
 * ## Supabase Storage とは？
 * Supabase が提供するオブジェクトストレージサービス。
 * PostgreSQL データベースと同じプロジェクトで使用でき、
 * 認証（RLS: Row Level Security）との統合が容易。
 *
 * ## 料金体系（参考）
 * - 無料枠: 1GB ストレージ、2GB 転送量/月
 * - Pro: $25/月〜（100GB ストレージ）
 *
 * ## 必要な環境変数
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase プロジェクトURL
 * - SUPABASE_SERVICE_ROLE_KEY: サービスロールキー（サーバーサイド専用）
 * - SUPABASE_STORAGE_BUCKET: バケット名（デフォルト: uploads）
 *
 * ## REST API使用
 * 公式SDKではなくREST APIを直接使用。
 * これによりパッケージサイズを削減し、依存関係を最小化。
 *
 * ## URL形式
 * https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
class SupabaseStorageProvider implements StorageProvider {
  /**
   * Supabase プロジェクトのURL
   *
   * 形式: https://xxxxx.supabase.co
   */
  private supabaseUrl: string

  /**
   * サービスロールキー
   *
   * 全ての操作が可能な特権キー。
   * サーバーサイドでのみ使用すること！
   * クライアントサイドには絶対に公開しない。
   */
  private supabaseKey: string

  /**
   * ストレージバケット名
   *
   * Supabase Storageの「フォルダ」に相当
   */
  private bucket: string

  /**
   * コンストラクタ
   *
   * 環境変数から認証情報を読み込み。
   * Supabase SDKは使用せず、REST API呼び出しで実装。
   */
  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads'
    logger.log('Storage provider initialized: supabase')
  }

  /**
   * ファイルをSupabase Storageにアップロード
   *
   * ## REST API エンドポイント
   * POST /storage/v1/object/{bucket}/{path}
   *
   * ## 認証
   * Authorization: Bearer {service_role_key}
   *
   * ## 処理フロー
   * 1. 認証情報の確認
   * 2. ユニークなファイル名を生成
   * 3. REST APIでアップロード
   * 4. 公開URLを返す
   */
  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      /**
       * 認証情報のバリデーション
       */
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      /**
       * ユニークなファイル名を生成
       */
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

      /**
       * REST APIでファイルをアップロード
       *
       * fetch(): Web標準のHTTPクライアント
       * - method: 'POST' でファイル作成
       * - headers: 認証情報とContent-Type
       * - body: ファイルデータ（Uint8Arrayに変換）
       *
       * new Uint8Array(file): BufferをUint8Arrayに変換
       * （fetch のbodyとして使用するため）
       */
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

      /**
       * レスポンスの確認
       *
       * response.ok: ステータスコードが200-299の場合true
       */
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Supabase upload failed: ${error}`)
      }

      /**
       * 公開URLを生成
       *
       * Supabaseの公開URLパターン:
       * /storage/v1/object/public/{bucket}/{path}
       *
       * 注意: バケットの公開設定が必要
       */
      const url = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${uniqueName}`

      logger.log('Supabase storage upload success:', url)
      return { success: true, url }
    } catch (err) {
      logger.error('Supabase storage upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * ファイルをSupabase Storageから削除
   *
   * ## REST API エンドポイント
   * DELETE /storage/v1/object/{bucket}/{path}
   *
   * ## URLからパスを抽出
   * 正規表現で /storage/v1/object/public/{bucket}/{path} からパスを取得
   */
  async delete(url: string): Promise<DeleteResult> {
    try {
      /**
       * 認証情報のバリデーション
       */
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      /**
       * URLからパスを取得
       *
       * 正規表現でURLからファイルパスを抽出:
       * /storage/v1/object/public/bucket-name/path/to/file.jpg
       * → pathMatch[1]: "path/to/file.jpg"
       */
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)
      if (!pathMatch) {
        throw new Error('Invalid Supabase storage URL')
      }
      const filePath = pathMatch[1]

      /**
       * REST APIでファイルを削除
       *
       * DELETE メソッドでファイルを削除
       */
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

      logger.log('Supabase storage delete success:', url)
      return { success: true }
    } catch (err) {
      logger.error('Supabase storage delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// ============================================================
// Cloudflare R2 ストレージプロバイダー
// ============================================================

/**
 * Cloudflare R2 を使用するストレージプロバイダー
 *
 * ## Cloudflare R2 とは？
 * Cloudflareが提供するS3互換オブジェクトストレージ。
 * 主な特徴:
 * - **エグレス無料**: データ転送（ダウンロード）が無料
 * - **S3互換API**: AWS S3 SDKがそのまま使える
 * - **グローバルCDN**: Cloudflareのエッジネットワークと統合
 *
 * ## 料金体系（参考）
 * - ストレージ: $0.015/GB/月（約¥2.25）
 * - Class A操作（書き込み）: $4.50/100万リクエスト
 * - Class B操作（読み取り）: $0.36/100万リクエスト
 * - **エグレス（転送）: 無料！** ← これが大きな魅力
 *
 * ## 必要な環境変数
 * - R2_ACCOUNT_ID: CloudflareアカウントID
 * - R2_ACCESS_KEY_ID: R2 APIアクセスキーID
 * - R2_SECRET_ACCESS_KEY: R2 APIシークレットキー
 * - R2_BUCKET_NAME: バケット名
 * - R2_PUBLIC_URL: 公開URL（オプション）
 *
 * ## S3互換APIとは？
 * AWS S3と同じAPIを実装しているため、
 * AWS SDK（@aws-sdk/client-s3）がそのまま使用可能。
 * エンドポイントを変更するだけでR2に接続できる。
 *
 * ## URL形式
 * カスタムドメイン: https://cdn.example.com/path/file.jpg
 * デフォルト: https://{bucket}.{account}.r2.dev/{path}
 */
class CloudflareR2StorageProvider implements StorageProvider {
  /**
   * AWS S3クライアント（S3互換API用）
   *
   * @aws-sdk/client-s3 を使用
   * eslint-disable: 遅延初期化のためany型を許可
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client: any = null

  /**
   * R2バケット名
   */
  private bucket: string

  /**
   * 公開URL（カスタムドメインまたはr2.dev）
   */
  private publicUrl: string

  /**
   * 初期化済みフラグ
   */
  private initialized: boolean = false

  /**
   * コンストラクタ
   *
   * 環境変数から設定を読み込み。
   * S3クライアントの初期化は遅延。
   */
  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || 'uploads'
    this.publicUrl = process.env.R2_PUBLIC_URL || ''
    logger.log('Storage provider initialized: r2')
  }

  /**
   * 遅延初期化の実行
   *
   * ## 機能概要
   * AWS S3 SDKをR2用に設定して初期化。
   *
   * ## R2のエンドポイント
   * https://{accountId}.r2.cloudflarestorage.com
   *
   * ## region: 'auto'
   * R2は自動的に最適なリージョンを選択するため、
   * 'auto' を指定。
   */
  private async ensureInitialized() {
    if (this.initialized) return

    /**
     * AWS S3 SDKを動的インポート
     *
     * S3Client: S3互換サービスへの接続を管理
     */
    const { S3Client } = await import('@aws-sdk/client-s3')

    /**
     * 環境変数から認証情報を取得
     */
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials not configured')
    }

    /**
     * S3クライアントをR2用に設定
     *
     * - region: 'auto'（R2が自動選択）
     * - endpoint: R2のエンドポイントURL
     * - credentials: R2 APIトークンの認証情報
     */
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })

    logger.log('Cloudflare R2 bucket:', this.bucket)
    this.initialized = true
  }

  /**
   * ファイルをCloudflare R2にアップロード
   *
   * ## S3 API: PutObject
   * オブジェクト（ファイル）をバケットに保存するコマンド。
   *
   * ## 処理フロー
   * 1. SDKの遅延初期化
   * 2. ユニークなファイル名を生成
   * 3. PutObjectCommandでアップロード
   * 4. 公開URLを返す
   */
  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      await this.ensureInitialized()

      /**
       * PutObjectCommandを動的インポート
       *
       * コマンドパターン: 操作をオブジェクトとしてカプセル化
       */
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')

      /**
       * ユニークなファイル名を生成
       */
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

      /**
       * アップロードコマンドを作成
       *
       * - Bucket: 保存先バケット
       * - Key: オブジェクトのパス（ファイル名）
       * - Body: ファイルデータ
       * - ContentType: MIMEタイプ
       */
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueName,
        Body: file,
        ContentType: contentType,
      })

      /**
       * コマンドを実行
       *
       * send(): クライアントにコマンドを送信して実行
       */
      await this.s3Client.send(command)

      /**
       * 公開URLを生成
       *
       * カスタムドメインが設定されていればそれを使用、
       * なければデフォルトのr2.devドメインを使用
       */
      const url = this.publicUrl
        ? `${this.publicUrl}/${uniqueName}`
        : `https://${this.bucket}.${process.env.R2_ACCOUNT_ID}.r2.dev/${uniqueName}`

      logger.log('R2 upload success:', url)
      return { success: true, url }
    } catch (err) {
      logger.error('R2 upload error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  /**
   * ファイルをCloudflare R2から削除
   *
   * ## S3 API: DeleteObject
   * バケットからオブジェクトを削除するコマンド。
   *
   * ## URLからキーを抽出
   * URL: https://cdn.example.com/folder/file.jpg
   * pathname: /folder/file.jpg
   * key: folder/file.jpg（先頭の/を除去）
   */
  async delete(url: string): Promise<DeleteResult> {
    try {
      await this.ensureInitialized()

      /**
       * DeleteObjectCommandを動的インポート
       */
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')

      /**
       * URLからキーを取得
       *
       * pathname.startsWith('/'): 先頭がスラッシュかチェック
       * slice(1): 先頭の1文字（スラッシュ）を除去
       */
      const urlObj = new URL(url)
      const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname

      /**
       * 削除コマンドを作成・実行
       */
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.s3Client.send(command)

      logger.log('R2 delete success:', url)
      return { success: true }
    } catch (err) {
      logger.error('R2 delete error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// ============================================================
// プロバイダー管理
// ============================================================

/**
 * プロバイダーのシングルトンインスタンス
 *
 * ## シングルトンパターンとは？
 * アプリケーション全体で1つのインスタンスのみ存在することを保証するパターン。
 *
 * ## なぜシングルトンか？
 * - 接続の効率化（毎回初期化しない）
 * - メモリの節約
 * - 状態の一貫性
 *
 * 初期値はnull、最初の使用時に初期化される
 */
let storageProvider: StorageProvider | null = null

/**
 * ストレージプロバイダーを取得
 *
 * ## 機能概要
 * 環境変数 STORAGE_PROVIDER に応じて適切なプロバイダーを返す。
 * 一度生成されたインスタンスは再利用される（シングルトン）。
 *
 * ## プロバイダー選択
 * | 環境変数 | プロバイダー |
 * |---------|-------------|
 * | supabase | SupabaseStorageProvider |
 * | r2 | CloudflareR2StorageProvider |
 * | azure | AzureBlobStorageProvider |
 * | local / 未設定 | LocalStorageProvider |
 *
 * ## 使用例
 * ```typescript
 * const provider = getStorageProvider()
 * const result = await provider.upload(file, name, type, folder)
 * ```
 *
 * @returns StorageProvider - ストレージプロバイダーのインスタンス
 */
function getStorageProvider(): StorageProvider {
  /**
   * 既存のインスタンスがあれば再利用
   */
  if (storageProvider) return storageProvider

  /**
   * 環境変数からプロバイダーを決定
   */
  const provider = process.env.STORAGE_PROVIDER || 'local'

  /**
   * switch文でプロバイダーを選択・初期化
   */
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
      /**
       * default: 未知の値の場合もローカルにフォールバック
       *
       * これにより、設定ミスがあってもアプリケーションは動作する
       */
      storageProvider = new LocalStorageProvider()
      break
  }

  return storageProvider
}

// ============================================================
// エクスポート関数
// ============================================================

/**
 * ファイルをアップロード
 *
 * ## 機能概要
 * 設定されたストレージプロバイダーにファイルをアップロードします。
 * 呼び出し側はプロバイダーの種類を意識する必要がありません。
 *
 * ## パラメータ
 * @param file - ファイルバッファ（バイナリデータ）
 * @param filename - 元のファイル名（参考情報）
 * @param contentType - MIMEタイプ（例: "image/jpeg"）
 * @param folder - 保存先フォルダ
 *   - "avatars": プロフィール画像
 *   - "headers": ヘッダー画像
 *   - "posts": 投稿画像
 *   - "shops": 盆栽園画像
 *
 * ## 戻り値
 * @returns Promise<UploadResult>
 *   - success: true, url: "https://..." （成功時）
 *   - success: false, error: "エラーメッセージ" （失敗時）
 *
 * ## 使用例
 * ```typescript
 * const result = await uploadFile(
 *   fileBuffer,
 *   'profile.jpg',
 *   'image/jpeg',
 *   'avatars'
 * )
 *
 * if (result.success) {
 *   console.log('Uploaded to:', result.url)
 * } else {
 *   console.error('Upload failed:', result.error)
 * }
 * ```
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
 *
 * ## 機能概要
 * 設定されたストレージプロバイダーからファイルを削除します。
 * URLからプロバイダーを判別し、適切な削除処理を行います。
 *
 * ## パラメータ
 * @param url - 削除するファイルのURL
 *   ローカル: /uploads/avatars/abc123.jpg
 *   Azure: https://account.blob.core.windows.net/...
 *   Supabase: https://xxx.supabase.co/storage/v1/...
 *   R2: https://cdn.example.com/...
 *
 * ## 戻り値
 * @returns Promise<DeleteResult>
 *   - success: true （成功時）
 *   - success: false, error: "エラーメッセージ" （失敗時）
 *
 * ## 使用例
 * ```typescript
 * const result = await deleteFile(user.avatarUrl)
 *
 * if (result.success) {
 *   console.log('File deleted successfully')
 * } else {
 *   console.error('Delete failed:', result.error)
 * }
 * ```
 *
 * ## 注意点
 * - 存在しないファイルを削除しようとするとエラーになる場合がある
 * - 削除は取り消し不可（バックアップが必要な場合は事前に対応）
 */
export async function deleteFile(url: string): Promise<DeleteResult> {
  const provider = getStorageProvider()
  return provider.delete(url)
}

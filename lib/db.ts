/**
 * データベース接続設定ファイル
 *
 * このファイルは、アプリケーション全体で使用するデータベース接続を管理します。
 * Prisma ORM（Object-Relational Mapping）を使用してPostgreSQLデータベースに接続します。
 *
 * ## なぜこのファイルが必要か？
 * - データベース接続は重いリソースなので、1つの接続を使い回す必要がある
 * - Next.jsの開発環境ではホットリロード時に複数の接続が作成されてしまう問題を防ぐ
 * - 本番環境と開発環境で異なる設定（SSL、ログレベル等）を適用する
 *
 * ## 使用方法
 * ```typescript
 * import { prisma } from '@/lib/db'
 *
 * // ユーザーを取得する例
 * const user = await prisma.user.findUnique({ where: { id: 'xxx' } })
 *
 * // 投稿を作成する例
 * const post = await prisma.post.create({
 *   data: { content: 'Hello', userId: 'xxx' }
 * })
 * ```
 *
 * @module lib/db
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * PrismaClient: Prisma ORMのメインクラス
 * データベースへのクエリ（検索、作成、更新、削除）を実行するために使用
 * 自動生成されたTypeScript型により、型安全なデータベース操作が可能
 */
import { PrismaClient } from '@prisma/client'

/**
 * PrismaPg: PostgreSQL用のPrismaアダプター
 * Prisma 5以降で導入された新しいアダプターシステム
 * PostgreSQLとの接続をより効率的に管理する
 */
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Pool: PostgreSQLの接続プール
 * 複数のデータベース接続を事前に作成して保持し、
 * 必要に応じて再利用することでパフォーマンスを向上させる
 */
import { Pool } from 'pg'

// ============================================================
// グローバル変数の設定
// ============================================================

/**
 * グローバルスコープにPrismaClientを保存するための型定義
 *
 * ## なぜグローバル変数を使うのか？
 * Next.jsの開発モードでは、ファイルが変更されるたびにモジュールが再読み込みされます。
 * その際、毎回新しいPrismaClientインスタンスが作成されると、
 * データベース接続が増え続けて「Too many connections」エラーが発生します。
 *
 * グローバル変数に保存することで、同じインスタンスを再利用できます。
 *
 * ## TypeScriptの型キャスト
 * `global as unknown as { prisma: PrismaClient }` という書き方は：
 * 1. `global` - Node.jsのグローバルオブジェクト
 * 2. `as unknown` - 一度unknown型に変換（型の互換性を無視）
 * 3. `as { prisma: PrismaClient }` - 目的の型に変換
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient }

// ============================================================
// PostgreSQL接続プールの作成
// ============================================================

/**
 * PostgreSQLの接続プールを作成
 *
 * ## 接続プールとは？
 * データベース接続の「プール（貯水池）」を事前に作成しておき、
 * クエリ実行時に空いている接続を借りて使い、終わったら返却する仕組み。
 *
 * ## 設定オプション
 * - connectionString: データベースのURL（環境変数から取得）
 *   形式: postgresql://ユーザー名:パスワード@ホスト:ポート/データベース名
 *
 * - ssl: SSL/TLS接続の設定
 *   - 本番環境: { rejectUnauthorized: false } で自己署名証明書を許可
 *   - 開発環境: false でSSLを無効化（ローカルDBは通常SSLなし）
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

/**
 * PrismaとPostgreSQLを接続するアダプターを作成
 * Prisma 5以降、PostgreSQLへの接続にはこのアダプターが必須
 */
const adapter = new PrismaPg(pool)

// ============================================================
// PrismaClientのエクスポート
// ============================================================

/**
 * PrismaClientのシングルトンインスタンス
 *
 * ## シングルトンパターンとは？
 * アプリケーション全体で1つのインスタンスだけを使用する設計パターン。
 * データベース接続のような重いリソースに適している。
 *
 * ## Nullish Coalescing演算子 (??)
 * `globalForPrisma.prisma ?? new PrismaClient(...)` は：
 * - globalForPrisma.prisma が存在すれば、それを使用
 * - 存在しなければ（null/undefined）、新しいPrismaClientを作成
 *
 * ## PrismaClientの設定オプション
 * - adapter: PostgreSQLアダプター（上で作成したもの）
 * - log: ログ出力の設定
 *   - 開発環境: ['query', 'error', 'warn'] - 詳細なログを出力
 *   - 本番環境: ['error'] - エラーのみ出力（パフォーマンス優先）
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: adapter, // ここでアダプターを渡すのが必須になりました
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// ============================================================
// 開発環境でのグローバル変数への保存
// ============================================================

/**
 * 開発環境でのみ、作成したPrismaClientをグローバル変数に保存
 *
 * ## なぜ本番環境では保存しないのか？
 * 本番環境ではホットリロードがないため、モジュールは一度だけ読み込まれます。
 * そのため、グローバル変数に保存する必要がありません。
 *
 * ## 開発環境での動作
 * 1. 最初のリクエスト: globalForPrisma.prisma は undefined
 *    → 新しい PrismaClient を作成し、エクスポート
 *    → グローバル変数に保存
 *
 * 2. ファイル変更後のリクエスト: globalForPrisma.prisma にインスタンスが存在
 *    → 既存のインスタンスを再利用
 */
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

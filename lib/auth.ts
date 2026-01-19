/**
 * 認証設定メインファイル
 *
 * このファイルは、NextAuth.js（Auth.js v5）を使用したユーザー認証機能を提供します。
 * メール/パスワードによるログイン、セッション管理、ユーザー登録を担当します。
 *
 * ## NextAuth.jsとは？
 * Next.js向けの認証ライブラリ。以下の機能を提供：
 * - 複数の認証プロバイダー対応（OAuth、メール/パスワード等）
 * - セッション管理（JWT or データベースセッション）
 * - CSRF保護
 * - 型安全なTypeScriptサポート
 *
 * ## このアプリの認証方式
 * - Credentials Provider: メールアドレス + パスワード
 * - JWT (JSON Web Token): セッション管理
 * - Prisma Adapter: ユーザーデータをPostgreSQLに保存
 *
 * ## エクスポートされる機能
 * - handlers: APIルートハンドラー（GET/POST）
 * - signIn: サインイン関数
 * - signOut: サインアウト関数
 * - auth: 現在のセッションを取得する関数
 *
 * @module lib/auth
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * NextAuth: NextAuth.jsのメイン関数
 *
 * 認証設定を受け取り、認証に必要な全ての関数をエクスポート
 */
import NextAuth from 'next-auth'

/**
 * PrismaAdapter: NextAuth.jsとPrismaを連携するアダプター
 *
 * ## アダプターとは？
 * NextAuth.jsがデータベースと通信するためのインターフェース
 * ユーザー、アカウント、セッション等のデータを永続化
 *
 * ## PrismaAdapterの役割
 * - ユーザー作成/検索
 * - セッション管理（DB セッション使用時）
 * - OAuth アカウント連携
 */
import { PrismaAdapter } from '@auth/prisma-adapter'

/**
 * CredentialsProvider: メール/パスワード認証プロバイダー
 *
 * ## OAuth vs Credentials
 * - OAuth: 外部サービス（Google、GitHub等）に認証を委任
 * - Credentials: 自前でユーザー名/パスワードを管理
 *
 * ## Credentialsの特徴
 * - 完全にカスタマイズ可能
 * - 独自のバリデーションロジックを実装可能
 * - パスワードのハッシュ化は自分で行う必要がある
 */
import CredentialsProvider from 'next-auth/providers/credentials'

/**
 * bcrypt: パスワードハッシュライブラリ
 *
 * ## なぜbcryptjsを使うか？
 * - bcrypt: C++バインディングが必要、環境依存
 * - bcryptjs: 純粋JavaScript実装、どこでも動作
 *
 * ## ハッシュ化とは？
 * パスワードを不可逆的に変換し、安全に保存する手法
 * 元のパスワードを復元することは不可能
 *
 * ## 比較方法
 * - 保存: hash('password') → '$2a$12$...'
 * - 検証: compare('password', '$2a$12$...') → true/false
 */
import bcrypt from 'bcryptjs'

/**
 * prisma: データベースクライアント
 * ユーザーデータの取得・作成に使用
 */
import { prisma } from '@/lib/db'

/**
 * z (Zod): スキーマバリデーションライブラリ
 *
 * ## Zodとは？
 * TypeScriptファーストのバリデーションライブラリ
 * - ランタイムでの型チェック
 * - 詳細なエラーメッセージ
 * - 型推論との統合
 *
 * ## 使用例
 * ```typescript
 * const schema = z.object({ name: z.string().min(1) })
 * const result = schema.safeParse(data)
 * if (result.success) {
 *   // result.data は型安全
 * }
 * ```
 */
import { z } from 'zod'

/**
 * authConfig: Edge Runtime対応の認証設定
 * middleware.tsで使用するための設定を含む
 */
import { authConfig } from '@/lib/auth.config' // インポート

// ============================================================
// バリデーションスキーマ
// ============================================================

/**
 * ログイン入力のバリデーションスキーマ
 *
 * ## 検証ルール
 * - email: 有効なメールアドレス形式
 * - password: 8文字以上
 *
 * ## なぜバリデーションが必要か？
 * - 不正な入力を早期に検出
 * - データベースクエリ前にチェック
 * - 明確なエラーメッセージをユーザーに提供
 *
 * ## safeParse vs parse
 * - parse: 無効な場合に例外をスロー
 * - safeParse: 成功/失敗オブジェクトを返す（推奨）
 */
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
})

// ============================================================
// NextAuth設定とエクスポート
// ============================================================

/**
 * NextAuth.js の設定とエクスポート
 *
 * ## 分割代入でエクスポートされる項目
 * - handlers: APIルートで使用（GET/POSTハンドラー）
 * - signIn: プログラムからのサインイン
 * - signOut: プログラムからのサインアウト
 * - auth: セッション取得関数
 *
 * ## 使用例
 * ```typescript
 * // Server Componentでセッション取得
 * const session = await auth()
 * if (session?.user?.id) {
 *   // 認証済み
 * }
 *
 * // APIルートで使用
 * export const { GET, POST } = handlers
 *
 * // ログアウト
 * await signOut()
 * ```
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  /**
   * authConfigを展開
   *
   * スプレッド構文（...）でauth.config.tsの設定を展開
   * pages, callbacks の基本設定を継承
   */
  ...authConfig, // configを展開

  /**
   * Prismaアダプター
   *
   * NextAuth.jsがデータベースにアクセスするために使用
   * ユーザー作成時にPrismaを通じてDBに保存
   */
  adapter: PrismaAdapter(prisma),

  /**
   * セッション戦略
   *
   * ## JWT vs Database
   * - jwt: トークンをクッキーに保存（ステートレス）
   * - database: セッションをDBに保存（ステートフル）
   *
   * ## JWTの利点
   * - DBへのアクセスが不要で高速
   * - サーバーレス環境に適している
   * - スケーラブル
   *
   * ## JWTの欠点
   * - トークンサイズが大きくなりがち
   * - 即座にセッションを無効化できない
   */
  session: {
    strategy: 'jwt',
  },

  /**
   * 認証プロバイダー
   *
   * Credentials Provider を使用してメール/パスワード認証を実装
   */
  providers: [
    CredentialsProvider({
      /**
       * プロバイダー名
       * UIに表示される名前（カスタムUIでは使用しない）
       */
      name: 'credentials',

      /**
       * authorize関数
       *
       * ## 役割
       * ユーザーの資格情報を検証し、認証を行う
       *
       * ## パラメータ
       * @param credentials - フォームから送信された資格情報
       *
       * ## 戻り値
       * - 成功: ユーザーオブジェクト
       * - 失敗: null
       *
       * ## 処理フロー
       * 1. 入力値のバリデーション
       * 2. データベースからユーザーを検索
       * 3. パスワードの検証
       * 4. ユーザーオブジェクトを返す
       */
      async authorize(credentials) {
        /**
         * Zodでバリデーション
         *
         * safeParse: 例外をスローせず、結果オブジェクトを返す
         * result.success: バリデーション成功かどうか
         * result.data: バリデーション済みのデータ
         */
        const result = loginSchema.safeParse(credentials)
        if (!result.success) return null

        /**
         * バリデーション済みデータを分割代入
         */
        const { email, password } = result.data

        /**
         * データベースからユーザーを検索
         *
         * findUnique: 一意な条件でレコードを取得
         * email はユニーク制約があるため使用可能
         * isSuspended: アカウント停止状態のチェック用
         */
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            nickname: true,
            avatarUrl: true,
            isSuspended: true,
          },
        })

        /**
         * ユーザー存在チェックとパスワード存在チェック
         *
         * ## user.password が null の場合
         * - OAuth でサインアップしたユーザー
         * - パスワードが設定されていない
         */
        if (!user || !user.password) return null

        /**
         * アカウント停止チェック
         *
         * 管理者によって停止されたアカウントはログイン不可
         * null を返すことで認証失敗として扱われる
         */
        if (user.isSuspended) return null

        /**
         * パスワードの検証
         *
         * bcrypt.compare:
         * - 第1引数: 入力されたパスワード（平文）
         * - 第2引数: 保存されているハッシュ
         * - 戻り値: 一致すればtrue
         */
        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        /**
         * 認証成功時のユーザーオブジェクト
         *
         * NextAuth.jsが期待する形式で返す
         * - id: 必須、ユーザーの一意識別子
         * - email: メールアドレス
         * - name: 表示名（このアプリではnickname）
         * - image: アバター画像URL
         */
        return {
          id: user.id,
          email: user.email,
          name: user.nickname,
          image: user.avatarUrl,
        }
      },
    }),
  ],

  /**
   * コールバック関数
   *
   * 認証フローの各段階で呼び出される
   * セッションにカスタムデータを追加するために使用
   */
  callbacks: {
    /**
     * JWTコールバック
     *
     * ## 役割
     * JWTトークンが作成/更新される際に呼び出される
     * トークンにカスタムデータを追加
     *
     * ## パラメータ
     * @param token - 現在のJWTトークン
     * @param user - authorize関数から返されたユーザー（初回サインイン時のみ）
     *
     * ## 処理
     * 初回サインイン時にユーザーIDをトークンに追加
     */
    async jwt({ token, user }) {
      // 初回サインイン時のみuserが存在
      if (user) {
        token.id = user.id
      }
      return token
    },

    /**
     * Sessionコールバック
     *
     * ## 役割
     * セッションオブジェクトが作成される際に呼び出される
     * クライアントに返すセッションデータをカスタマイズ
     *
     * ## パラメータ
     * @param session - セッションオブジェクト
     * @param token - JWTトークン（JWT戦略の場合）
     *
     * ## 処理
     * トークンからユーザーIDをセッションに追加
     * これにより、クライアント側でsession.user.idにアクセス可能
     */
    async session({ session, token }) {
      // セッションにユーザーIDを追加
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})

// ============================================================
// ユーザー登録関数
// ============================================================

/**
 * ユーザー登録関数
 *
 * ## 機能概要
 * 新規ユーザーをデータベースに登録
 *
 * ## パラメータ
 * @param data.email - メールアドレス
 * @param data.password - パスワード（平文）
 * @param data.nickname - 表示名
 *
 * ## 処理フロー
 * 1. メールアドレスの重複チェック
 * 2. パスワードをハッシュ化
 * 3. ユーザーをデータベースに作成
 *
 * ## セキュリティ考慮事項
 * - パスワードは平文で保存しない（bcryptでハッシュ化）
 * - ハッシュのラウンド数: 12（セキュリティと性能のバランス）
 *
 * ## 使用例
 * ```typescript
 * try {
 *   const user = await registerUser({
 *     email: 'user@example.com',
 *     password: 'securePassword123',
 *     nickname: 'ユーザー名',
 *   })
 * } catch (error) {
 *   // 重複エラーの処理
 * }
 * ```
 *
 * ## 注意
 * コメントにある通り、この関数は lib/user.ts など
 * 別ファイルに分離することも検討できます
 */
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  /**
   * メールアドレスの重複チェック
   *
   * 既存ユーザーが存在する場合はエラーをスロー
   */
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })
  if (existingUser) throw new Error('このメールアドレスは既に使用されています')

  /**
   * パスワードのハッシュ化
   *
   * ## bcrypt.hash の引数
   * - 第1引数: 平文パスワード
   * - 第2引数: ラウンド数（コスト係数）
   *
   * ## ラウンド数とは？
   * - 高いほど安全だが、計算時間が増加
   * - 12は一般的な推奨値
   * - 2^12 = 4096回のハッシュ処理
   */
  const hashedPassword = await bcrypt.hash(data.password, 12)

  /**
   * ユーザーを作成してデータベースに保存
   *
   * 作成されたユーザーオブジェクトを返す
   */
  return await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })
}

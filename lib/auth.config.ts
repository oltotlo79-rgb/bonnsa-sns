/**
 * 認証設定ファイル（Edge Runtime対応版）
 *
 * このファイルは、Next.js Middlewareで使用する認証設定を提供します。
 * Edge Runtimeで動作する必要があるため、Node.js専用の機能（Prisma等）を
 * 含めることができません。
 *
 * ## なぜファイルを分けるのか？
 *
 * ### Edge Runtime の制約
 * Next.js Middlewareは「Edge Runtime」で実行されます。
 * Edge Runtimeは軽量で高速ですが、Node.jsの全機能は使えません。
 *
 * ### 使えないもの（例）
 * - Prisma（データベースアクセス）
 * - bcrypt（パスワードハッシュ）
 * - Node.js固有のモジュール
 *
 * ### 解決策
 * 認証設定を2つのファイルに分割：
 * 1. auth.config.ts（このファイル）- Edge Runtime対応、認可ロジックのみ
 * 2. auth.ts - Node.js環境、認証プロバイダーやDB操作を含む
 *
 * ## 使用される場所
 * - middleware.ts: ページアクセス時の認可チェック
 * - auth.ts: 認証設定のベースとして使用
 *
 * @module lib/auth.config
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * NextAuthConfig: NextAuth.jsの設定型
 *
 * ## typeインポートとは？
 * `import type` は型情報のみをインポートする構文
 * ランタイムコードには含まれず、TypeScriptの型チェックにのみ使用
 *
 * ## なぜtypeインポートを使うか？
 * - バンドルサイズが小さくなる
 * - Edge Runtimeでの互換性が向上
 * - 意図が明確になる（「これは型定義だけ」）
 */
import type { NextAuthConfig } from "next-auth";

// ============================================================
// 定数定義
// ============================================================

/**
 * 公開ページのパス一覧（ログイン不要でアクセス可能）
 *
 * ## 含まれるページ
 * - '/': トップページ（ランディングページ）
 * - '/login': ログインページ
 * - '/register': 新規登録ページ
 * - '/password-reset': パスワードリセット申請ページ
 * - '/verify-email': メール認証ページ
 *
 * ## なぜ配列で管理するか？
 * - 追加・削除が容易
 * - 一覧性が高い
 * - コードの意図が明確
 */
const publicPaths = ['/', '/login', '/register', '/password-reset', '/verify-email']

// ============================================================
// 設定オブジェクト
// ============================================================

/**
 * NextAuth.js の基本設定
 *
 * ## satisfies演算子とは？
 * TypeScript 4.9で導入された機能
 * - 型チェックを行いつつ、より具体的な型推論を維持
 * - `as NextAuthConfig` との違い: 型を強制せず、検証のみ行う
 *
 * ## 設定項目の概要
 * - pages: カスタムページのURL設定
 * - callbacks: 認証フローの各段階で実行される関数
 * - providers: 認証プロバイダー（このファイルでは空）
 */
export const authConfig = {
  /**
   * カスタム認証ページの設定
   *
   * ## pages.signIn
   * 未認証ユーザーがアクセスした時のリダイレクト先
   * デフォルト: /api/auth/signin
   * カスタム: /login（独自デザインのログインページ）
   *
   * ## pages.error
   * 認証エラー時のリダイレクト先
   * 例: OAuthエラー、セッション切れなど
   */
  pages: {
    signIn: '/login',
    error: '/login',
  },

  /**
   * コールバック関数
   *
   * NextAuth.jsは認証フローの各段階でコールバックを呼び出す
   * ここで認可ロジック（アクセス許可/拒否の判定）を実装
   */
  callbacks: {
    /**
     * authorized コールバック
     *
     * ## 役割
     * ミドルウェアで各リクエストに対してアクセス許可を判定
     *
     * ## パラメータ
     * @param auth - 現在の認証状態（セッション情報）
     * @param request - HTTPリクエスト情報
     *   - nextUrl: URLオブジェクト（パスやクエリパラメータを含む）
     *
     * ## 戻り値
     * @returns boolean | Response
     *   - true: アクセス許可
     *   - false: ログインページにリダイレクト
     *   - Response: カスタムレスポンス（リダイレクト等）
     *
     * ## 処理フロー
     * 1. ユーザーがログイン済みかチェック
     * 2. リクエストパスを分類（公開/API/静的/保護）
     * 3. 保護されたページには認証を要求
     */
    authorized({ auth, request: { nextUrl } }) {
      /**
       * ログイン状態の判定
       *
       * !! (二重否定) を使って boolean に変換
       * - auth?.user が存在 → true
       * - auth?.user が null/undefined → false
       */
      const isLoggedIn = !!auth?.user

      /**
       * リクエストされたパス
       * 例: '/feed', '/posts/123', '/settings'
       */
      const pathname = nextUrl.pathname

      /**
       * 公開ページの判定
       *
       * ## some() メソッド
       * 配列の少なくとも1つの要素が条件を満たすかチェック
       *
       * ## 判定ロジック
       * - 完全一致: pathname === path
       * - 前方一致: pathname.startsWith(path + '/')
       *
       * ## 例
       * '/login' → true（完全一致）
       * '/login/callback' → true（前方一致）
       * '/feed' → false（どちらにも一致しない）
       */
      const isPublicPage = publicPaths.some((path) =>
        pathname === path || pathname.startsWith(path + '/')
      )

      /**
       * APIルートの判定
       *
       * '/api' で始まるパスはAPIエンドポイント
       * API認証は各ルートハンドラで個別に行うため、
       * ミドルウェアでは許可
       */
      const isApiRoute = pathname.startsWith('/api')

      /**
       * 静的ファイルの判定
       *
       * ## /_next
       * Next.jsが生成する静的アセット（JS、CSS、画像など）
       *
       * ## ドットを含むパス
       * ファイル拡張子を持つパス（.png, .jpg, .ico など）
       * 静的ファイルへの直接アクセス
       *
       * ## なぜ静的ファイルを除外するか？
       * - 認証不要なリソース
       * - パフォーマンスのため（不要な認証チェックを省略）
       */
      const isStaticFile = pathname.startsWith('/_next') ||
        pathname.includes('.') // .png, .jpg, etc.

      /**
       * アクセス許可の判定
       *
       * ## 許可されるケース
       * 1. 公開ページ（ログイン不要）
       * 2. APIルート（個別に認証）
       * 3. 静的ファイル（認証不要）
       *
       * ## 認証が必要なケース
       * 上記以外のすべてのページ
       * → isLoggedIn の値を返す
       *   - ログイン済み: true（アクセス許可）
       *   - 未ログイン: false（ログインページにリダイレクト）
       */
      if (isPublicPage || isApiRoute || isStaticFile) {
        return true
      }

      // 保護されたページはログインが必要
      return isLoggedIn
    },
  },

  /**
   * 認証プロバイダー（空配列）
   *
   * ## なぜ空か？
   * - プロバイダー設定（Credentials等）はNode.js APIを使用
   * - Edge Runtimeでは動作しない
   * - auth.ts で上書きして設定する
   *
   * ## 配列を空にする理由
   * - 型エラーを防ぐ（providersは必須プロパティ）
   * - auth.tsでスプレッド構文で展開後、上書き可能
   */
  providers: [], // ここは空にする（auth.tsで上書きする）
} satisfies NextAuthConfig;

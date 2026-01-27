/**
 * ログインフォームコンポーネント
 *
 * このファイルは、ユーザーログインのためのフォームUIを提供します。
 * ログインページ (/login) で使用され、NextAuth.jsによる認証を処理します。
 *
 * ## 機能概要
 * - メールアドレス入力フィールド
 * - パスワード入力フィールド（表示/非表示切り替え機能付き）
 * - NextAuth.js Credentials Providerによる認証処理
 * - ブルートフォース攻撃対策のためのレート制限チェック
 * - エラーメッセージ表示（認証失敗時）
 * - ログイン成功後のフィードページへのリダイレクト
 * - パスワードリセット・新規登録へのリンク
 *
 * ## 認証フロー
 * 1. ユーザーがメールアドレスとパスワードをフォームに入力
 * 2. フォーム送信時にレート制限チェックを実行（ブルートフォース攻撃対策）
 * 3. signIn('credentials', {...})でNextAuth.jsに認証リクエストを送信
 * 4. NextAuth.jsがバックエンドで認証処理を実行
 * 5. 成功時: JWTトークンが発行され、/feedへリダイレクト
 * 6. 失敗時: エラーメッセージを画面に表示
 *
 * ## 使用例
 * ```tsx
 * // app/(auth)/login/page.tsx
 * import { LoginForm } from '@/components/auth/LoginForm'
 *
 * export default function LoginPage() {
 *   return (
 *     <div className="container mx-auto max-w-md py-8">
 *       <h1 className="text-2xl font-bold mb-6">ログイン</h1>
 *       <LoginForm />
 *     </div>
 *   )
 * }
 * ```
 *
 * ## セキュリティ考慮事項
 * - パスワードはマスク表示がデフォルト（ユーザーがトグルで切り替え可能）
 * - ブルートフォース攻撃対策としてレート制限を実装
 * - 認証エラー時は具体的な原因を明かさない汎用メッセージを表示
 *
 * @module components/auth/LoginForm
 * @see {@link https://next-auth.js.org/} NextAuth.js公式ドキュメント
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * NextAuth.jsのサインイン関数
 *
 * クライアントサイドから認証処理を実行するための関数。
 * 'credentials'プロバイダを使用してメール/パスワード認証を行う。
 *
 * @see {@link https://next-auth.js.org/getting-started/client#signin}
 */
import { signIn } from 'next-auth/react'

/**
 * Next.js App Routerのナビゲーション用フック
 *
 * クライアントサイドでのページ遷移とルーターのリフレッシュに使用。
 * push()でページ遷移、refresh()でサーバーコンポーネントの再取得を行う。
 *
 * @see {@link https://nextjs.org/docs/app/api-reference/functions/use-router}
 */
import { useRouter } from 'next/navigation'

/**
 * React useState, useEffect フック
 *
 * コンポーネント内の状態管理に使用。
 * このコンポーネントでは以下の状態を管理:
 * - error: エラーメッセージ
 * - loading: 送信中の状態
 * - showPassword: パスワード表示/非表示の状態
 * - fingerprint: デバイスフィンガープリント
 *
 * @see {@link https://react.dev/reference/react/useState}
 */
import { useState, useEffect } from 'react'

/**
 * shadcn/ui Buttonコンポーネント
 *
 * スタイル済みのボタンUIコンポーネント。
 * disabled属性でローディング中の操作を防止。
 *
 * @see {@link https://ui.shadcn.com/docs/components/button}
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui Inputコンポーネント
 *
 * スタイル済みの入力フィールドUIコンポーネント。
 * メールアドレスとパスワードの入力に使用。
 *
 * @see {@link https://ui.shadcn.com/docs/components/input}
 */
import { Input } from '@/components/ui/input'

/**
 * shadcn/ui Labelコンポーネント
 *
 * フォームフィールドのラベルUIコンポーネント。
 * htmlFor属性で対応する入力フィールドと紐付け。
 *
 * @see {@link https://ui.shadcn.com/docs/components/label}
 */
import { Label } from '@/components/ui/label'

/**
 * Next.js Linkコンポーネント
 *
 * クライアントサイドナビゲーションを提供するリンクコンポーネント。
 * パスワードリセットページと新規登録ページへのリンクに使用。
 * 通常の<a>タグと異なり、ページ全体をリロードせずに遷移する。
 *
 * @see {@link https://nextjs.org/docs/app/api-reference/components/link}
 */
import Link from 'next/link'

/**
 * ログイン試行のレート制限チェック用Server Action
 *
 * ブルートフォース攻撃対策として、同一メールアドレスへの
 * ログイン試行回数を制限するための関数。
 * 制限に達した場合はログイン処理をブロックする。
 *
 * @see lib/actions/auth.ts
 */
import { checkLoginAllowed } from '@/lib/actions/auth'

/**
 * 2段階認証関連のServer Actions
 */
import { check2FARequired, verify2FAToken } from '@/lib/actions/two-factor'

/**
 * デバイスフィンガープリント取得関数
 *
 * FingerprintJSを使用してブラウザのフィンガープリントを収集。
 * 不正利用防止のためのデバイス識別に使用される。
 *
 * @see lib/fingerprint.ts
 */
import { getFingerprintWithCache } from '@/lib/fingerprint'

/**
 * デバイスブラックリストチェック用Server Action
 *
 * ログイン時にデバイスがブラックリストに登録されていないか確認。
 *
 * @see lib/actions/blacklist.ts
 */
import { isDeviceBlacklisted } from '@/lib/actions/blacklist'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * EyeIconコンポーネントのプロパティ型定義
 */
interface EyeIconProps {
  /**
   * SVGアイコンに適用する追加のCSSクラス名
   * サイズや色のカスタマイズに使用
   *
   * @example "h-4 w-4" - 16x16ピクセルのサイズ
   * @example "text-gray-500" - グレーの色
   */
  className?: string
}

/**
 * 目のアイコン（パスワード表示状態を示すアイコン）
 *
 * パスワードが現在マスク表示されている状態で表示され、
 * クリックするとパスワードがテキスト表示に切り替わることを示す。
 * SVGで実装されており、strokeベースのアイコン。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名（省略可能）
 * @returns 目のアイコンのSVG要素
 *
 * @example
 * ```tsx
 * <EyeIcon className="h-4 w-4" />
 * ```
 */
function EyeIcon({ className }: EyeIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 目の外形（楕円形の目の形状） */}
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      {/* 瞳（中心の円） */}
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/**
 * EyeOffIconコンポーネントのプロパティ型定義
 */
interface EyeOffIconProps {
  /**
   * SVGアイコンに適用する追加のCSSクラス名
   * サイズや色のカスタマイズに使用
   */
  className?: string
}

/**
 * 目を閉じたアイコン（パスワード非表示状態を示すアイコン）
 *
 * パスワードが現在テキスト表示されている状態で表示され、
 * クリックするとパスワードがマスク表示に切り替わることを示す。
 * 斜線が入った目のアイコンでSVGで実装。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名（省略可能）
 * @returns 目を閉じたアイコンのSVG要素
 *
 * @example
 * ```tsx
 * <EyeOffIcon className="h-4 w-4" />
 * ```
 */
function EyeOffIcon({ className }: EyeOffIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 部分的に見える瞳 */}
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      {/* 目の上部 */}
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      {/* 目の下部 */}
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      {/* 斜線（目を隠す線） */}
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * ログインフォームコンポーネント
 *
 * ユーザーがメールアドレスとパスワードを入力してログインするための
 * フォームUIを提供するReactコンポーネント。
 *
 * ## 主な機能
 * - メールアドレスとパスワードによるCredentials認証
 * - パスワード入力フィールドの表示/非表示トグル
 * - ログイン処理中のローディング状態表示
 * - 認証エラー時のエラーメッセージ表示
 * - ブルートフォース攻撃対策のレート制限
 * - パスワードリセットページへのリンク
 * - 新規登録ページへのリンク
 *
 * ## 状態管理
 * - error: 認証エラーメッセージ
 * - loading: フォーム送信中かどうか
 * - showPassword: パスワードを平文表示するかどうか
 *
 * ## アクセシビリティ
 * - Labelコンポーネントでフォームフィールドにラベル付け
 * - aria-labelでパスワードトグルボタンにラベル付け
 * - required属性で必須フィールドをマーク
 *
 * @returns ログインフォームのJSX要素
 *
 * @example
 * ```tsx
 * // 基本的な使用方法
 * <LoginForm />
 *
 * // ページ内での使用
 * export default function LoginPage() {
 *   return (
 *     <Card>
 *       <CardHeader>
 *         <CardTitle>ログイン</CardTitle>
 *       </CardHeader>
 *       <CardContent>
 *         <LoginForm />
 *       </CardContent>
 *     </Card>
 *   )
 * }
 * ```
 */
export function LoginForm() {
  // ------------------------------------------------------------
  // 状態管理（useState フック）
  // ------------------------------------------------------------

  /**
   * Next.js App Routerのルーターインスタンス
   *
   * ログイン成功後のページ遷移に使用。
   * - push('/feed'): フィードページへ遷移
   * - refresh(): サーバーコンポーネントを再取得してセッション状態を反映
   */
  const router = useRouter()

  /**
   * エラーメッセージの状態
   *
   * 認証失敗時やバリデーションエラー時に表示するメッセージを保持。
   * - null: エラーなし（正常状態）
   * - string: エラーメッセージ（画面に赤字で表示される）
   *
   * @example
   * setError('メールアドレスまたはパスワードが間違っています')
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ローディング状態
   *
   * フォーム送信中（認証処理中）かどうかを示すフラグ。
   * - true: 認証処理中（ボタンを無効化、テキストを「ログイン中...」に変更）
   * - false: 待機状態（通常の操作が可能）
   *
   * 二重送信を防止し、ユーザーに処理中であることを視覚的にフィードバック。
   */
  const [loading, setLoading] = useState(false)

  /**
   * パスワード表示/非表示状態
   *
   * パスワード入力フィールドの表示形式を制御。
   * - true: パスワードをテキスト表示（type="text"）
   * - false: パスワードをマスク表示（type="password"）
   *
   * セキュリティとユーザビリティのバランスを取るため、
   * デフォルトはマスク表示で、ユーザーが必要に応じて切り替え可能。
   */
  const [showPassword, setShowPassword] = useState(false)

  /**
   * 2段階認証関連の状態
   */
  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null)

  /**
   * デバイスフィンガープリント
   *
   * FingerprintJSによって取得されたデバイス識別子。
   * ブラックリストチェックに使用される。
   */
  const [fingerprint, setFingerprint] = useState<string | null>(null)

  // ------------------------------------------------------------
  // 副作用（useEffect フック）
  // ------------------------------------------------------------

  /**
   * コンポーネントマウント時にデバイスフィンガープリントを取得
   *
   * FingerprintJSを使用してブラウザの特徴からフィンガープリントを生成。
   * ブラックリストに登録されたデバイスからのログインを防止するために使用。
   */
  useEffect(() => {
    async function collectFingerprint() {
      const fp = await getFingerprintWithCache()
      if (fp) {
        setFingerprint(fp)
      }
    }
    collectFingerprint()
  }, [])

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フォーム送信ハンドラ
   *
   * ユーザーがログインボタンをクリックした際に実行される非同期関数。
   * NextAuth.jsを使用した認証処理を行い、結果に応じて
   * ページ遷移またはエラー表示を行う。
   *
   * ## 処理フロー
   * 1. デフォルトのフォーム送信動作を防止（ページリロード防止）
   * 2. ローディング状態を開始し、既存のエラーをクリア
   * 3. フォームからメールアドレスとパスワードを取得
   * 4. レート制限チェックを実行（ブルートフォース攻撃対策）
   * 5. NextAuth.jsのsignIn関数で認証リクエストを送信
   * 6. 認証成功: フィードページへリダイレクト
   * 7. 認証失敗: エラーメッセージを表示
   * 8. 例外発生: 汎用エラーメッセージを表示
   *
   * ## セキュリティ考慮事項
   * - redirect: falseを指定してクライアント側で結果をハンドリング
   * - エラーメッセージは具体的な原因を明かさない汎用的なものを使用
   * - レート制限チェックでブルートフォース攻撃を防止
   *
   * @param e - フォームのsubmitイベントオブジェクト
   * @returns Promise<void>
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    /**
     * デフォルトのフォーム送信動作を防止
     *
     * 通常のフォーム送信はページをリロードするが、
     * SPAとして動作させるため、JavaScriptで制御する。
     */
    e.preventDefault()

    /**
     * ローディング状態を開始し、既存のエラーをクリア
     *
     * ユーザーに処理中であることを示し、
     * 前回のエラーメッセージを非表示にする。
     */
    setLoading(true)
    setError(null)

    /**
     * FormDataオブジェクトからフォームの値を取得
     *
     * FormDataはフォーム要素から自動的にname属性を
     * キーとして値を収集するWeb標準API。
     */
    const formData = new FormData(e.currentTarget)

    /**
     * メールアドレスを取得
     * name="email"の入力フィールドの値
     */
    const email = formData.get('email') as string

    /**
     * パスワードを取得
     * name="password"の入力フィールドの値
     */
    const password = formData.get('password') as string

    try {
      // ----------------------------------------------------------------
      // レート制限チェック（ブルートフォース攻撃対策）
      // ----------------------------------------------------------------

      /**
       * ログイン試行が許可されているかチェック
       *
       * 同一メールアドレスへの短時間での連続ログイン試行を検知し、
       * ブルートフォース攻撃を防止する。
       * Server Actionを呼び出してサーバー側でチェックを実行。
       */
      try {
        const checkResult = await checkLoginAllowed(email)

        /**
         * レート制限に達している場合は処理を中断
         * エラーメッセージを表示してログイン処理を実行しない
         */
        if (!checkResult.allowed) {
          setError(checkResult.message || 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。')
          setLoading(false)
          return
        }
      } catch (checkError) {
        /**
         * レート制限チェックでエラーが発生した場合
         *
         * フェイルオープン方式: チェック自体が失敗しても
         * ログイン処理は続行する（可用性を優先）。
         * ただし、エラーはログに記録する。
         */
        console.error('Login check error:', checkError)
        // レート制限チェックでエラーが発生してもログイン処理は続行（フェイルオープン）
      }

      // ----------------------------------------------------------------
      // デバイスブラックリストチェック
      // ----------------------------------------------------------------

      /**
       * デバイスがブラックリストに登録されていないかチェック
       *
       * ブラックリストに登録されたデバイスからのログインを拒否する。
       * これにより、不正利用ユーザーのデバイスからのアクセスを防止。
       */
      if (fingerprint) {
        try {
          const deviceBlocked = await isDeviceBlacklisted(fingerprint)
          if (deviceBlocked) {
            setError('このデバイスからのログインは許可されていません')
            setLoading(false)
            return
          }
        } catch (deviceCheckError) {
          // デバイスチェックでエラーが発生してもログイン処理は続行（フェイルオープン）
          console.error('Device blacklist check error:', deviceCheckError)
        }
      }

      // ----------------------------------------------------------------
      // 2段階認証チェック
      // ----------------------------------------------------------------

      /**
       * 2FAが有効なユーザーかどうかをチェック
       *
       * 2FAが有効な場合は、パスワード認証後に追加の認証ステップが必要
       */
      const twoFactorCheck = await check2FARequired(email)

      if (twoFactorCheck.required && twoFactorCheck.userId) {
        // 2FA認証が必要な場合、認証情報を一時保存してステップを進める
        // まずパスワードが正しいか確認するためNextAuth認証を実行
        const preAuthResult = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (preAuthResult?.error) {
          setError('メールアドレスまたはパスワードが間違っています')
          setLoading(false)
          return
        }

        // パスワード認証成功、2FAステップへ
        // 注: この時点でセッションは作成されているが、2FA検証後に実際のリダイレクトを行う
        setPendingUserId(twoFactorCheck.userId)
        setPendingCredentials({ email, password })
        setRequires2FA(true)
        setLoading(false)
        return
      }

      // ----------------------------------------------------------------
      // NextAuth.jsによる認証処理（2FA不要の場合）
      // ----------------------------------------------------------------

      /**
       * NextAuth.jsのCredentials Providerで認証を実行
       *
       * @param 'credentials' - 使用するプロバイダ名
       * @param options - 認証オプション
       * @param options.email - ユーザーのメールアドレス
       * @param options.password - ユーザーのパスワード
       * @param options.redirect - false を指定してリダイレクトを無効化
       *                          これにより、認証結果をJavaScriptで処理可能
       *
       * @returns 認証結果オブジェクト（error, ok, status, url等を含む）
       */
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      // ----------------------------------------------------------------
      // 認証結果の処理
      // ----------------------------------------------------------------

      /**
       * 認証失敗時のエラー処理
       *
       * result.errorが存在する場合は認証に失敗している。
       * セキュリティ上の理由から、具体的なエラー原因
       * （メールが存在しない、パスワードが違う等）は
       * ユーザーに開示せず、汎用的なメッセージを表示。
       */
      if (result?.error) {
        setError('メールアドレスまたはパスワードが間違っています')
        setLoading(false)
        return
      }

      /**
       * 認証成功時の処理
       *
       * 1. router.push('/feed'): フィードページへ遷移
       * 2. router.refresh(): サーバーコンポーネントを再取得
       *    - これにより、認証状態が反映されたUIが表示される
       *    - ヘッダーのログイン/ログアウトボタン等が更新される
       */
      router.push('/feed')
      router.refresh()
    } catch (err) {
      /**
       * 予期せぬエラーのハンドリング
       *
       * ネットワークエラーやサーバーエラーなど、
       * 認証処理自体が失敗した場合のフォールバック。
       * エラーをコンソールに記録し、ユーザーに再試行を促す。
       */
      console.error('Login error:', err)
      setError('ログイン中にエラーが発生しました。再度お試しください。')
      setLoading(false)
    }
  }

  // ------------------------------------------------------------
  // 2段階認証検証ハンドラ
  // ------------------------------------------------------------

  /**
   * 2FAコードを検証するハンドラ
   *
   * 2FAステップでユーザーが認証コードを入力した際に実行される。
   * TOTPコードまたはバックアップコードを検証し、
   * 成功した場合はフィードページへリダイレクトする。
   */
  async function handleVerify2FA(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!pendingUserId) {
      setError('認証情報が見つかりません。もう一度ログインしてください。')
      setRequires2FA(false)
      setLoading(false)
      return
    }

    try {
      const verifyResult = await verify2FAToken(pendingUserId, twoFactorCode)

      if ('error' in verifyResult) {
        setError(verifyResult.error)
        setLoading(false)
        return
      }

      // 2FA検証成功、フィードページへ遷移
      router.push('/feed')
      router.refresh()
    } catch (err) {
      console.error('2FA verification error:', err)
      setError('認証中にエラーが発生しました。再度お試しください。')
      setLoading(false)
    }
  }

  /**
   * 2FAステップをキャンセルしてログインフォームに戻る
   */
  function handleCancel2FA() {
    setRequires2FA(false)
    setTwoFactorCode('')
    setPendingUserId(null)
    setPendingCredentials(null)
    setError(null)
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  // 2段階認証ステップ
  if (requires2FA) {
    return (
      <form onSubmit={handleVerify2FA} className="space-y-4">
        {/* ============================================================ */}
        {/* 2FA説明 */}
        {/* ============================================================ */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary">
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">2段階認証</h2>
          <p className="text-sm text-muted-foreground">
            認証アプリに表示されている6桁のコードを入力してください。
          </p>
          <p className="text-xs text-muted-foreground">
            または、バックアップコードを入力できます。
          </p>
        </div>

        {/* ============================================================ */}
        {/* 認証コード入力 */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <Label htmlFor="twoFactorCode">認証コード</Label>
          <Input
            id="twoFactorCode"
            name="twoFactorCode"
            type="text"
            inputMode="text"
            placeholder="000000 または バックアップコード"
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
            required
            autoComplete="one-time-code"
            className="text-center text-lg tracking-widest"
          />
        </div>

        {/* ============================================================ */}
        {/* エラーメッセージ表示エリア */}
        {/* ============================================================ */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* ============================================================ */}
        {/* ボタン */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !twoFactorCode}
          >
            {loading ? '確認中...' : '確認'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCancel2FA}
            disabled={loading}
          >
            キャンセル
          </Button>
        </div>
      </form>
    )
  }

  return (
    /**
     * ログインフォーム要素
     *
     * space-y-4: 子要素間に1remの垂直スペースを設定
     * onSubmit: フォーム送信時にhandleSubmit関数を実行
     */
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ============================================================ */}
      {/* メールアドレス入力フィールド */}
      {/* ============================================================ */}
      <div className="space-y-2">
        {/* ラベル: htmlForでinput要素と紐付け */}
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="mail@example.com"
          required                    // 必須フィールド
          autoComplete="email"        // ブラウザのオートコンプリートを有効化
        />
      </div>

      {/* ============================================================ */}
      {/* パスワード入力フィールド（表示/非表示トグル付き） */}
      {/* ============================================================ */}
      <div className="space-y-2">
        <Label htmlFor="password">パスワード</Label>
        <div className="relative">
          {/* パスワード入力 */}
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}  // 状態に応じて表示形式を切り替え
            placeholder="8文字以上（英字・数字を含む）"
            required                      // 必須フィールド
            minLength={8}                 // 最小8文字
            autoComplete="current-password"  // 既存パスワードのオートコンプリート
            className="pr-10"             // 右側にトグルボタン用のスペースを確保
          />

          {/* パスワード表示/非表示トグルボタン */}
          <button
            type="button"   // type="submit"ではないためフォーム送信しない
            onClick={() => setShowPassword(!showPassword)}  // クリックで状態を反転
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}  // スクリーンリーダー用
          >
            {/* 現在の状態に応じたアイコンを表示 */}
            {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />  // 表示中 → 非表示アイコン
            ) : (
              <EyeIcon className="h-4 w-4" />     // 非表示中 → 表示アイコン
            )}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* エラーメッセージ表示エリア */}
      {/* ============================================================ */}
      {/* エラーがある場合のみ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* ============================================================ */}
      {/* ログインボタン */}
      {/* ============================================================ */}
      <Button
        type="submit"
        className="w-full"      // 幅100%
        disabled={loading}      // ローディング中は無効化
      >
        {/* ローディング状態に応じてボタンテキストを変更 */}
        {loading ? 'ログイン中...' : 'ログイン'}
      </Button>

      {/* ============================================================ */}
      {/* 補助リンク（パスワードリセット・新規登録） */}
      {/* ============================================================ */}
      <div className="text-center text-sm space-y-2">
        {/* パスワードリセットリンク */}
        <p>
          <Link href="/password-reset" className="text-primary hover:underline">
            パスワードをお忘れですか？
          </Link>
        </p>

        {/* 新規登録リンク */}
        <p className="text-muted-foreground">
          アカウントをお持ちでない方は{' '}
          <Link href="/register" className="text-primary hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </form>
  )
}

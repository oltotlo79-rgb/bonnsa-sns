/**
 * ユーザー登録フォームコンポーネント
 *
 * このファイルは、新規ユーザー登録のためのフォームUIを提供します。
 * 登録ページ (/register) で使用され、ユーザーアカウントの作成と
 * 登録完了後の自動ログインを処理します。
 *
 * ## 機能概要
 * - ニックネーム入力フィールド（表示名として使用）
 * - メールアドレス入力フィールド
 * - パスワード入力フィールド（表示/非表示切り替え機能付き）
 * - パスワード確認入力フィールド（表示/非表示切り替え機能付き）
 * - 利用規約・プライバシーポリシーへの同意チェックボックス
 * - クライアント側バリデーション（パスワード一致確認、強度チェック）
 * - Server Actionによるユーザー登録処理
 * - 登録成功後のNextAuth.jsによる自動ログイン
 * - 登録・ログイン成功後のフィードページへのリダイレクト
 *
 * ## パスワード要件
 * 以下のすべての条件を満たす必要があります:
 * - 8文字以上
 * - アルファベット（a-z, A-Z）を1文字以上含む
 * - 数字（0-9）を1文字以上含む
 *
 * ## 登録フロー
 * 1. ユーザーがフォームに必要事項を入力
 * 2. 利用規約・プライバシーポリシーに同意
 * 3. フォーム送信時にクライアント側バリデーションを実行
 * 4. バリデーション成功後、Server Actionでユーザー登録
 * 5. 登録成功後、NextAuth.jsで自動ログイン
 * 6. ログイン成功後、フィードページへリダイレクト
 *
 * ## 使用例
 * ```tsx
 * // app/(auth)/register/page.tsx
 * import { RegisterForm } from '@/components/auth/RegisterForm'
 *
 * export default function RegisterPage() {
 *   return (
 *     <div className="container mx-auto max-w-md py-8">
 *       <h1 className="text-2xl font-bold mb-6">新規登録</h1>
 *       <RegisterForm />
 *     </div>
 *   )
 * }
 * ```
 *
 * ## セキュリティ考慮事項
 * - パスワードはマスク表示がデフォルト
 * - パスワード強度チェックを実施
 * - 利用規約への同意を必須化
 * - Server Action内でメールアドレスの重複チェックを実施
 *
 * @module components/auth/RegisterForm
 * @see {@link https://next-auth.js.org/} NextAuth.js公式ドキュメント
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * NextAuth.jsのサインイン関数
 *
 * 登録完了後の自動ログインに使用。
 * 新規登録したユーザーを即座にログイン状態にすることで、
 * ユーザー体験を向上させる。
 *
 * @see {@link https://next-auth.js.org/getting-started/client#signin}
 */
import { signIn } from 'next-auth/react'

/**
 * Next.js App Routerのナビゲーション用フック
 *
 * 登録・ログイン成功後のページ遷移に使用。
 * push()でフィードページへ遷移し、refresh()でセッション状態を反映。
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
 * - showConfirmPassword: 確認用パスワード表示/非表示の状態
 * - agreedToTerms: 利用規約同意の状態
 * - fingerprint: デバイスフィンガープリント
 *
 * @see {@link https://react.dev/reference/react/useState}
 */
import { useState, useEffect } from 'react'

/**
 * shadcn/ui Buttonコンポーネント
 *
 * スタイル済みのボタンUIコンポーネント。
 * disabled属性でローディング中や未同意時の操作を防止。
 *
 * @see {@link https://ui.shadcn.com/docs/components/button}
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui Inputコンポーネント
 *
 * スタイル済みの入力フィールドUIコンポーネント。
 * ニックネーム、メールアドレス、パスワードの入力に使用。
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
 * ログインページ、利用規約、プライバシーポリシーへのリンクに使用。
 *
 * @see {@link https://nextjs.org/docs/app/api-reference/components/link}
 */
import Link from 'next/link'

/**
 * ユーザー登録用Server Action
 *
 * サーバー側でユーザー登録処理を実行する関数。
 * - メールアドレスの重複チェック
 * - パスワードのハッシュ化
 * - データベースへのユーザー情報保存
 *
 * @see lib/actions/auth.ts
 */
import { registerUser } from '@/lib/actions/auth'

/**
 * デバイスフィンガープリント取得関数
 *
 * FingerprintJSを使用してブラウザのフィンガープリントを収集。
 * 不正利用防止のためのデバイス識別に使用される。
 *
 * @see lib/fingerprint.ts
 */
import { getFingerprintWithCache } from '@/lib/fingerprint'

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
   */
  className?: string
}

/**
 * 目のアイコン（パスワード表示状態を示すアイコン）
 *
 * パスワードが現在マスク表示されている状態で表示され、
 * クリックするとパスワードがテキスト表示に切り替わることを示す。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名（省略可能）
 * @returns 目のアイコンのSVG要素
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
   */
  className?: string
}

/**
 * 目を閉じたアイコン（パスワード非表示状態を示すアイコン）
 *
 * パスワードが現在テキスト表示されている状態で表示され、
 * クリックするとパスワードがマスク表示に切り替わることを示す。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名（省略可能）
 * @returns 目を閉じたアイコンのSVG要素
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
 * ユーザー登録フォームコンポーネント
 *
 * 新規ユーザーがアカウントを作成するためのフォームUIを提供する
 * Reactコンポーネント。
 *
 * ## 主な機能
 * - 必須入力フィールド（ニックネーム、メール、パスワード）
 * - パスワード入力フィールドの表示/非表示トグル
 * - パスワード確認フィールドの表示/非表示トグル
 * - クライアント側バリデーション
 *   - パスワード一致確認
 *   - パスワード長チェック（8文字以上）
 *   - パスワード強度チェック（英数字必須）
 * - 利用規約・プライバシーポリシーへの同意チェック
 * - Server Actionによるユーザー登録
 * - 登録成功後の自動ログイン
 * - ログインページへのリンク
 *
 * ## 状態管理
 * - error: 登録エラーメッセージ
 * - loading: フォーム送信中かどうか
 * - showPassword: パスワードを平文表示するかどうか
 * - showConfirmPassword: 確認用パスワードを平文表示するかどうか
 * - agreedToTerms: 利用規約に同意したかどうか
 *
 * ## バリデーション
 * クライアント側で以下のバリデーションを実行:
 * 1. 利用規約への同意確認
 * 2. パスワード一致確認
 * 3. パスワード長チェック（8文字以上）
 * 4. パスワード強度チェック（英字と数字の両方を含む）
 *
 * ## アクセシビリティ
 * - Labelコンポーネントでフォームフィールドにラベル付け
 * - aria-labelでパスワードトグルボタンにラベル付け
 * - required属性で必須フィールドをマーク
 *
 * @returns ユーザー登録フォームのJSX要素
 *
 * @example
 * ```tsx
 * // 基本的な使用方法
 * <RegisterForm />
 *
 * // ページ内での使用
 * export default function RegisterPage() {
 *   return (
 *     <Card>
 *       <CardHeader>
 *         <CardTitle>新規登録</CardTitle>
 *       </CardHeader>
 *       <CardContent>
 *         <RegisterForm />
 *       </CardContent>
 *     </Card>
 *   )
 * }
 * ```
 */
export function RegisterForm() {
  // ------------------------------------------------------------
  // 状態管理（useState フック）
  // ------------------------------------------------------------

  /**
   * Next.js App Routerのルーターインスタンス
   *
   * 登録・ログイン成功後のページ遷移に使用。
   * - push('/feed'): フィードページへ遷移
   * - refresh(): サーバーコンポーネントを再取得してセッション状態を反映
   */
  const router = useRouter()

  /**
   * エラーメッセージの状態
   *
   * バリデーションエラーや登録エラー時に表示するメッセージを保持。
   * - null: エラーなし（正常状態）
   * - string: エラーメッセージ（画面に赤字で表示される）
   *
   * 表示されるエラー例:
   * - 「利用規約とプライバシーポリシーに同意してください」
   * - 「パスワードが一致しません」
   * - 「パスワードは8文字以上で入力してください」
   * - 「このメールアドレスは既に登録されています」
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ローディング状態
   *
   * フォーム送信中（登録処理中）かどうかを示すフラグ。
   * - true: 登録処理中（ボタンを無効化、テキストを「登録中...」に変更）
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
   * デフォルトはマスク表示で、ユーザーが入力内容を確認したい場合に切り替え可能。
   */
  const [showPassword, setShowPassword] = useState(false)

  /**
   * 確認用パスワード表示/非表示状態
   *
   * パスワード確認入力フィールドの表示形式を制御。
   * パスワードフィールドとは独立して切り替え可能。
   * - true: テキスト表示
   * - false: マスク表示
   */
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /**
   * 利用規約同意状態
   *
   * ユーザーが利用規約とプライバシーポリシーに同意したかどうか。
   * - true: 同意済み（登録ボタンが有効化）
   * - false: 未同意（登録ボタンが無効化）
   *
   * 登録を完了するには必ず同意が必要。
   */
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  /**
   * デバイスフィンガープリント
   *
   * FingerprintJSによって取得されたデバイス識別子。
   * 不正利用防止のためにサーバーへ送信される。
   */
  const [fingerprint, setFingerprint] = useState<string | null>(null)

  // ------------------------------------------------------------
  // 副作用（useEffect フック）
  // ------------------------------------------------------------

  /**
   * コンポーネントマウント時にデバイスフィンガープリントを取得
   *
   * FingerprintJSを使用してブラウザの特徴からフィンガープリントを生成。
   * ブラックリストに登録されたデバイスからの登録を防止するために使用。
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
   * ユーザーが新規登録ボタンをクリックした際に実行される非同期関数。
   * クライアント側バリデーション、Server Actionによる登録処理、
   * 自動ログイン、ページ遷移を順次実行する。
   *
   * ## 処理フロー
   * 1. デフォルトのフォーム送信動作を防止
   * 2. ローディング状態を開始し、既存のエラーをクリア
   * 3. フォームから入力値を取得
   * 4. クライアント側バリデーションを実行:
   *    a. 利用規約同意チェック
   *    b. パスワード一致確認
   *    c. パスワード長チェック
   *    d. パスワード強度チェック
   * 5. Server Actionでユーザー登録を実行
   * 6. 登録成功後、NextAuth.jsで自動ログイン
   * 7. ログイン成功後、フィードページへリダイレクト
   *
   * ## エラーハンドリング
   * - バリデーションエラー: 対応するエラーメッセージを表示
   * - 登録エラー（メール重複など）: Server Actionからのエラーを表示
   * - ログインエラー: ログインページへの誘導メッセージを表示
   *
   * @param e - フォームのsubmitイベントオブジェクト
   * @returns Promise<void>
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    /**
     * デフォルトのフォーム送信動作を防止
     * SPAとして動作させるため、ページリロードを抑止
     */
    e.preventDefault()

    /**
     * ローディング状態を開始し、既存のエラーをクリア
     */
    setLoading(true)
    setError(null)

    /**
     * FormDataオブジェクトからフォームの値を取得
     */
    const formData = new FormData(e.currentTarget)

    /**
     * メールアドレスを取得
     * アカウントの一意識別子およびログインIDとして使用
     */
    const email = formData.get('email') as string

    /**
     * パスワードを取得
     * ハッシュ化してデータベースに保存される
     */
    const password = formData.get('password') as string

    /**
     * 確認用パスワードを取得
     * パスワードの入力ミスを防ぐために二重入力を要求
     */
    const confirmPassword = formData.get('confirmPassword') as string

    /**
     * ニックネームを取得
     * プロフィールや投稿での表示名として使用
     */
    const nickname = formData.get('nickname') as string

    // ================================================================
    // クライアント側バリデーション
    // ================================================================

    /**
     * 利用規約同意チェック
     *
     * サービスを利用するには利用規約とプライバシーポリシーへの
     * 同意が法的に必要なため、同意がない場合は登録を拒否。
     */
    if (!agreedToTerms) {
      setError('利用規約とプライバシーポリシーに同意してください')
      setLoading(false)
      return
    }

    /**
     * パスワード一致確認
     *
     * パスワードと確認用パスワードが一致しない場合、
     * 入力ミスの可能性があるため登録を中断。
     */
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    /**
     * パスワード長チェック
     *
     * セキュリティ上の理由から、パスワードは最低8文字以上を要求。
     * HTML属性のminLengthでも制御しているが、JSでも二重チェック。
     */
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    /**
     * パスワード強度チェック（英数字混合）
     *
     * 辞書攻撃やブルートフォース攻撃への耐性を高めるため、
     * アルファベットと数字の両方を含むことを要求。
     */
    const hasLetter = /[a-zA-Z]/.test(password)  // 英字が含まれているか
    const hasNumber = /[0-9]/.test(password)     // 数字が含まれているか

    if (!hasLetter || !hasNumber) {
      setError('パスワードはアルファベットと数字を両方含めてください')
      setLoading(false)
      return
    }

    // ================================================================
    // Server Actionによるユーザー登録
    // ================================================================

    /**
     * registerUser Server Actionを呼び出してユーザー登録を実行
     *
     * Server Action内で以下の処理が行われる:
     * - メールアドレスのブラックリストチェック
     * - デバイスフィンガープリントのブラックリストチェック
     * - メールアドレスの重複チェック
     * - パスワードのbcryptハッシュ化
     * - データベースへのユーザー情報保存
     *
     * @returns 成功時: { success: true, userId: string }
     * @returns 失敗時: { error: string }
     */
    const result = await registerUser({
      email,
      password,
      nickname,
      fingerprint: fingerprint || undefined,
    })

    /**
     * 登録エラー時の処理
     *
     * Server Actionからエラーが返された場合
     * （例: メールアドレスが既に登録されている）
     */
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // ================================================================
    // 自動ログイン処理
    // ================================================================

    /**
     * 登録成功後、自動的にログインを実行
     *
     * ユーザー体験向上のため、登録完了後に再度ログインフォームを
     * 入力させることなく、シームレスにログイン状態へ移行する。
     */
    const signInResult = await signIn('credentials', {
      email,
      password,
      redirect: false,  // クライアント側でリダイレクトを制御
    })

    /**
     * 自動ログイン失敗時の処理
     *
     * 稀なケースだが、登録は成功したがログインに失敗した場合は、
     * ユーザーにログインページから手動でログインするよう案内する。
     */
    if (signInResult?.error) {
      setError('登録は完了しましたが、ログインに失敗しました。ログインページからお試しください。')
      setLoading(false)
      return
    }

    // ================================================================
    // ページ遷移
    // ================================================================

    /**
     * 登録・ログイン成功後、フィードページへリダイレクト
     *
     * router.refresh()でサーバーコンポーネントを再取得し、
     * 認証状態が反映されたUIを表示する。
     */
    router.push('/feed')
    router.refresh()
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    /**
     * ユーザー登録フォーム要素
     *
     * space-y-4: 子要素間に1remの垂直スペースを設定
     * onSubmit: フォーム送信時にhandleSubmit関数を実行
     */
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ============================================================ */}
      {/* ニックネーム入力フィールド */}
      {/* ============================================================ */}
      <div className="space-y-2">
        <Label htmlFor="nickname">ニックネーム</Label>
        <Input
          id="nickname"
          name="nickname"
          type="text"
          placeholder="表示名"
          required              // 必須フィールド
          maxLength={50}        // 最大50文字
        />
      </div>

      {/* ============================================================ */}
      {/* メールアドレス入力フィールド */}
      {/* ============================================================ */}
      <div className="space-y-2">
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
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}  // 状態に応じて表示形式を切り替え
            placeholder="8文字以上（英字・数字を含む）"
            required                      // 必須フィールド
            minLength={8}                 // 最小8文字
            autoComplete="new-password"   // 新規パスワードのオートコンプリート
            className="pr-10"             // 右側にトグルボタン用のスペースを確保
          />

          {/* パスワード表示/非表示トグルボタン */}
          <button
            type="button"   // type="submit"ではないためフォーム送信しない
            onClick={() => setShowPassword(!showPassword)}  // クリックで状態を反転
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* パスワード確認入力フィールド（表示/非表示トグル付き） */}
      {/* ============================================================ */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">パスワード（確認）</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}  // 状態に応じて表示形式を切り替え
            placeholder="もう一度入力"
            required                      // 必須フィールド
            minLength={8}                 // 最小8文字（元のパスワードと同じ要件）
            autoComplete="new-password"   // 新規パスワードのオートコンプリート
            className="pr-10"
          />

          {/* 確認用パスワード表示/非表示トグルボタン */}
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showConfirmPassword ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 利用規約・プライバシーポリシー同意チェックボックス */}
      {/* ============================================================ */}
      <div className="flex items-start gap-2">
        {/*
          同意チェックボックス
          チェックされるとagreedToTerms状態がtrueになり、登録ボタンが有効化される
        */}
        <input
          type="checkbox"
          id="agreeTerms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}  // チェック状態を状態に反映
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />

        {/* 同意文言とリンク */}
        <label htmlFor="agreeTerms" className="text-sm text-muted-foreground">
          {/* 利用規約へのリンク（新しいタブで開く） */}
          <Link href="/terms" target="_blank" className="text-primary hover:underline">
            利用規約
          </Link>
          および
          {/* プライバシーポリシーへのリンク（新しいタブで開く） */}
          <Link href="/privacy" target="_blank" className="text-primary hover:underline">
            プライバシーポリシー
          </Link>
          に同意します
        </label>
      </div>

      {/* ============================================================ */}
      {/* エラーメッセージ表示エリア */}
      {/* ============================================================ */}
      {/* エラーがある場合のみ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* ============================================================ */}
      {/* 新規登録ボタン */}
      {/* ============================================================ */}
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !agreedToTerms}  // ローディング中または未同意時は無効化
      >
        {/* ローディング状態に応じてボタンテキストを変更 */}
        {loading ? '登録中...' : '新規登録'}
      </Button>

      {/* ============================================================ */}
      {/* ログインページへのリンク */}
      {/* ============================================================ */}
      <p className="text-center text-sm text-muted-foreground">
        既にアカウントをお持ちの方は{' '}
        <Link href="/login" className="text-primary hover:underline">
          ログイン
        </Link>
      </p>
    </form>
  )
}

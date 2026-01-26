/**
 * ============================================================================
 * ログインフォームコンポーネントのテスト
 * ============================================================================
 *
 * このファイルは、ログインフォームのUIとインタラクションをテストします。
 *
 * ## コンポーネントテストとは？
 * Reactコンポーネントが正しく動作するかを検証するテスト。
 * - UIが正しく表示されるか
 * - ユーザー操作に対して正しく反応するか
 * - 状態の変化が正しく反映されるか
 *
 * ## 使用しているライブラリ
 * - React Testing Library: Reactコンポーネントのテスト用
 * - user-event: ユーザー操作（クリック、タイプなど）のシミュレーション
 * - Jest: テストランナー、アサーション、モック
 *
 * ## テスト観点
 * - フォームの表示
 * - 入力の動作
 * - ログインボタンの動作
 * - 成功/失敗時の処理
 * - ローディング状態
 * - リンクの表示
 */

// ============================================================================
// インポート
// ============================================================================

/**
 * テストユーティリティのインポート
 *
 * - render: コンポーネントをテスト用のDOMにレンダリング
 * - screen: レンダリングされた要素を検索するためのオブジェクト
 * - waitFor: 非同期処理の完了を待つ
 */
import { render, screen, waitFor } from '../../utils/test-utils'

/**
 * userEventのインポート
 *
 * ユーザー操作をシミュレートするライブラリ。
 * fireEventよりもリアルなユーザー操作を再現できる。
 *
 * 例：
 * - userEvent.type(): キーボード入力
 * - userEvent.click(): マウスクリック
 * - userEvent.hover(): マウスホバー
 */
import userEvent from '@testing-library/user-event'

/**
 * テスト対象のコンポーネント
 */
import { LoginForm } from '@/components/auth/LoginForm'

// ============================================================================
// モックのセットアップ
// ============================================================================

/**
 * NextAuth（認証ライブラリ）のモック
 * ----------------------------------------------------------------------------
 * NextAuthは認証機能を提供するライブラリ。
 * テストでは実際の認証処理を行わず、モックで動作を模擬します。
 *
 * - signIn: ログイン処理を行う関数
 * - SessionProvider: セッション情報を子コンポーネントに提供
 * - useSession: 現在のセッション状態を取得するフック
 */
const mockSignIn = jest.fn()
jest.mock('next-auth/react', () => ({
  // signInをモック関数に置き換え
  signIn: (...args: unknown[]) => mockSignIn(...args),
  // SessionProviderは子要素をそのまま返す（何もしない）
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  // 未認証状態を返す
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

/**
 * Next.jsのナビゲーション機能のモック
 * ----------------------------------------------------------------------------
 * ログイン成功後のページ遷移やリダイレクトをテストするために必要。
 *
 * - useRouter: ルーター機能を提供するフック
 *   - push: ページ遷移
 *   - refresh: ページのリフレッシュ
 * - useSearchParams: URLのクエリパラメータを取得するフック
 */
const mockPush = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,      // ページ遷移
    refresh: mockRefresh, // ページリフレッシュ
  }),
  // 空のURLSearchParamsを返す（クエリパラメータなし）
  useSearchParams: () => new URLSearchParams(),
}))

/**
 * レート制限関連のServer Actionsのモック
 * ----------------------------------------------------------------------------
 * ブルートフォース攻撃対策の機能をモック。
 * テストでは常にログイン試行を許可する設定に。
 */
jest.mock('@/lib/actions/auth', () => ({
  // ログイン試行を常に許可
  checkLoginAllowed: jest.fn().mockResolvedValue({ allowed: true }),
  // ログイン失敗の記録（何もしない）
  recordLoginFailure: jest.fn().mockResolvedValue(undefined),
  // ログイン試行回数のリセット（何もしない）
  clearLoginAttempts: jest.fn().mockResolvedValue(undefined),
}))

// ============================================================================
// テストスイート
// ============================================================================
describe('LoginForm', () => {
  /**
   * 各テスト前の準備
   *
   * モックの呼び出し履歴をクリアして、
   * 各テストが独立して実行されるようにします。
   */
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // ヘルパー関数
  // --------------------------------------------------------------------------
  /**
   * 要素を取得するヘルパー関数
   *
   * 同じ要素を何度も取得する場合、ヘルパー関数を作ると
   * コードが読みやすくなり、変更時の修正箇所も減ります。
   *
   * screen.getByPlaceholderText():
   * placeholder属性の値で要素を検索します。
   * フォーム入力要素を見つけるのに便利。
   */
  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')

  // --------------------------------------------------------------------------
  // 表示テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース1: フォームの初期表示
   *
   * ログインフォームに必要な要素が
   * すべて表示されていることを確認します。
   *
   * テスト観点：
   * - メールアドレス入力欄
   * - パスワード入力欄
   * - ログインボタン
   */
  it('ログインフォームを表示する', () => {
    // コンポーネントをレンダリング
    render(<LoginForm />)

    // 各要素が存在することを確認
    // toBeInTheDocument(): 要素がDOMに存在することを確認
    expect(getEmailInput()).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()

    // screen.getByRole(): ARIA roleで要素を検索
    // 'button'は<button>要素やrole="button"の要素にマッチ
    // { name: /ログイン/i } は正規表現でテキストを検索（iは大文字小文字を無視）
    expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 入力テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース2: メールアドレスの入力
   *
   * ユーザーがメールアドレスを入力できることを確認。
   */
  it('メールアドレスを入力できる', async () => {
    // userEvent.setup(): ユーザー操作のシミュレーターを初期化
    const user = userEvent.setup()

    render(<LoginForm />)
    const emailInput = getEmailInput()

    // user.type(): キーボード入力をシミュレート
    // 実際のユーザーのようにキーを1つずつ押す動作を再現
    await user.type(emailInput, 'test@example.com')

    // toHaveValue(): 入力値を確認
    expect(emailInput).toHaveValue('test@example.com')
  })

  /**
   * テストケース3: パスワードの入力
   */
  it('パスワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const passwordInput = getPasswordInput()
    await user.type(passwordInput, 'password123')
    expect(passwordInput).toHaveValue('password123')
  })

  // --------------------------------------------------------------------------
  // フォーム送信テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース4: ログインボタンのクリック
   *
   * フォーム送信時にsignIn関数が正しい引数で呼ばれることを確認。
   *
   * なぜこのテストが重要か：
   * - 認証処理が正しく呼び出されることを保証
   * - 引数が正しいことで、バックエンドとの連携が正常に動作
   */
  it('ログインボタンをクリックするとsignInが呼ばれる', async () => {
    // ログイン成功を模擬
    mockSignIn.mockResolvedValue({ ok: true })

    const user = userEvent.setup()
    render(<LoginForm />)

    // フォームに入力
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')

    // ログインボタンをクリック
    await user.click(screen.getByRole('button', { name: /ログイン/i }))

    // waitFor(): 非同期処理が完了するまで待機
    // コールバック内のアサーションが成功するまでリトライする
    await waitFor(() => {
      // expect.objectContaining(): オブジェクトの一部のプロパティだけを検証
      // 他のプロパティがあっても無視される
      expect(mockSignIn).toHaveBeenCalledWith('credentials', expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
        redirect: false, // クライアント側でリダイレクトを制御
      }))
    })
  })

  /**
   * テストケース5: ログイン成功後のリダイレクト
   *
   * ログイン成功時にフィードページに遷移することを確認。
   */
  it('ログイン成功時にフィードページへリダイレクトする', async () => {
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))

    await waitFor(() => {
      // /feedへのページ遷移を確認
      expect(mockPush).toHaveBeenCalledWith('/feed')
      // ページリフレッシュが呼ばれたことを確認
      // （セッション情報の更新のため）
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // エラーハンドリングテスト
  // --------------------------------------------------------------------------
  /**
   * テストケース6: ログイン失敗時のエラー表示
   *
   * 認証失敗時にユーザーにエラーメッセージが表示されることを確認。
   *
   * UX観点：
   * - ユーザーに何が問題かを伝える
   * - 次のアクションを促す
   */
  it('ログイン失敗時にエラーメッセージを表示する', async () => {
    // ログイン失敗を模擬
    mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' })

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))

    // エラーメッセージが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // ローディング状態テスト
  // --------------------------------------------------------------------------
  /**
   * テストケース7: ローディング中の状態
   *
   * ログイン処理中はボタンが無効化され、
   * 「ログイン中」と表示されることを確認。
   *
   * UX観点：
   * - 二重送信の防止
   * - 処理中であることをユーザーに伝える
   */
  it('ログイン中はボタンが無効化される', async () => {
    // signInの解決を遅延させる
    // mockImplementation: モック関数の実装を定義
    // setTimeout: 100ms後にPromiseを解決
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100)))

    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /ログイン/i }))

    // ローディング中のボタンテキストを確認
    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeInTheDocument()

    // toBeDisabled(): ボタンが無効化されていることを確認
    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeDisabled()
  })

  // --------------------------------------------------------------------------
  // リンクテスト
  // --------------------------------------------------------------------------
  /**
   * テストケース8: 新規登録リンクの表示
   *
   * アカウントを持っていないユーザーのための
   * 新規登録ページへのリンクが表示されることを確認。
   */
  it('新規登録リンクを表示する', () => {
    render(<LoginForm />)

    // テキストが存在することを確認
    expect(screen.getByText(/アカウントをお持ちでない方/i)).toBeInTheDocument()

    // リンクのhref属性を確認
    // screen.getByRole('link'): <a>要素を検索
    // toHaveAttribute(): 属性の値を確認
    expect(screen.getByRole('link', { name: /新規登録/i })).toHaveAttribute('href', '/register')
  })

  /**
   * テストケース9: パスワードリセットリンクの表示
   *
   * パスワードを忘れたユーザーのための
   * パスワードリセットページへのリンクが表示されることを確認。
   */
  it('パスワードリセットリンクを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('link', { name: /パスワードをお忘れですか/i })).toHaveAttribute('href', '/password-reset')
  })

  // --------------------------------------------------------------------------
  // パスワード表示切り替えテスト
  // --------------------------------------------------------------------------
  /**
   * テストケース10: パスワードの表示/非表示切り替え
   *
   * セキュリティ機能として、パスワードの
   * 表示/非表示を切り替えられることを確認。
   *
   * UX観点：
   * - 入力ミスを確認できる
   * - 初期状態は非表示（セキュリティ）
   */
  it('パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const passwordInput = getPasswordInput()

    // 初期状態はパスワードが非表示（type="password"）
    // toHaveAttribute(): 属性と値を確認
    expect(passwordInput).toHaveAttribute('type', 'password')

    // 「パスワードを表示」ボタンをクリック
    const toggleButton = screen.getByRole('button', { name: /パスワードを表示/i })
    await user.click(toggleButton)

    // パスワードが表示される（type="text"）
    expect(passwordInput).toHaveAttribute('type', 'text')

    // 「パスワードを隠す」ボタンをクリック
    const hideButton = screen.getByRole('button', { name: /パスワードを隠す/i })
    await user.click(hideButton)

    // パスワードが非表示に戻る
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  // --------------------------------------------------------------------------
  // プレースホルダーテスト
  // --------------------------------------------------------------------------
  /**
   * テストケース11-12: プレースホルダーの表示
   *
   * 入力欄にヒントとなるプレースホルダーが
   * 表示されていることを確認。
   *
   * UX観点：
   * - ユーザーに入力形式を伝える
   * - 空の状態でも何を入力すべきかわかる
   */
  it('メールアドレスのプレースホルダーが表示される', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('mail@example.com')).toBeInTheDocument()
  })

  it('パスワードのプレースホルダーが表示される', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('8文字以上（英字・数字を含む）')).toBeInTheDocument()
  })
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * 1. 単一ファイルのテスト
 *    npm test -- __tests__/components/auth/LoginForm.test.tsx
 *
 * 2. ウォッチモード
 *    npm test -- --watch __tests__/components/auth/LoginForm.test.tsx
 *
 * 3. カバレッジ付き
 *    npm test -- --coverage __tests__/components/auth/LoginForm.test.tsx
 *
 * ## React Testing Libraryのベストプラクティス
 *
 * 1. 要素の検索は「ユーザーがどう見るか」を基準に
 *    - getByRole（推奨）: アクセシビリティロールで検索
 *    - getByLabelText: ラベルのテキストで検索
 *    - getByPlaceholderText: プレースホルダーで検索
 *    - getByText: テキスト内容で検索
 *
 * 2. getBy vs queryBy vs findBy
 *    - getBy: 要素が存在しないとエラー（存在を期待する場合）
 *    - queryBy: 要素が存在しなくてもnullを返す（存在しないことを確認する場合）
 *    - findBy: 非同期で要素を検索（表示されるまで待つ）
 *
 * 3. ユーザー操作はuserEventを使用
 *    - fireEventより実際のユーザー操作に近い
 *    - フォーカス、ブラー、キーストロークなどを正しくシミュレート
 */

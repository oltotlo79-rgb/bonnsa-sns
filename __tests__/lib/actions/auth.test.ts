/**
 * ============================================================================
 * 認証関連のServer Actionsテスト
 * ============================================================================
 *
 * このファイルは、認証機能（ログイン、新規登録、パスワードリセット）を
 * テストします。
 *
 * ## テストの対象
 * - checkLoginAllowed: ログイン許可チェック（ブルートフォース攻撃対策）
 * - recordLoginFailure: ログイン失敗の記録
 * - clearLoginAttempts: ログイン試行回数のリセット
 * - registerUser: 新規ユーザー登録
 * - requestPasswordReset: パスワードリセットメールの送信
 * - resetPassword: 新しいパスワードの設定
 * - verifyPasswordResetToken: リセットトークンの検証
 *
 * ## Server Actionsとは？
 * Next.js 14以降で使える機能で、'use server'ディレクティブを使って
 * サーバーサイドで実行される関数を定義できます。
 * フォーム送信やデータベース操作など、セキュアな処理に使われます。
 *
 * ## なぜNode環境でテストするのか？
 * Server Actionsはサーバーサイドで実行されるため、
 * ブラウザ環境ではなくNode.js環境でテストする必要があります。
 *
 * @jest-environment node
 */

// テストユーティリティからモックデータとヘルパー関数をインポート
// createMockPrismaClient: Prismaクライアントのモック（DB操作を模擬）
// mockUser: テスト用のダミーユーザーデータ
// mockPasswordResetToken: テスト用のパスワードリセットトークン
import { createMockPrismaClient, mockUser, mockPasswordResetToken } from '../../utils/test-utils'

// ============================================================================
// モックのセットアップ
// ============================================================================
// モック（Mock）とは：
// 実際の依存関係（データベース、外部API等）の代わりに使う偽物のオブジェクト。
// テストを高速化し、外部要因に依存しない再現可能なテストを実現します。

/**
 * Prismaクライアントのモック
 * ----------------------------------------------------------------------------
 * データベース操作を模擬するためのモックオブジェクトを作成。
 * 実際のデータベースに接続せずにテストできるようになります。
 *
 * createMockPrismaClient()は以下のようなメソッドを持つオブジェクトを返します：
 * - prisma.user.findUnique() - ユーザーの検索
 * - prisma.user.create() - ユーザーの作成
 * - prisma.passwordResetToken.create() - トークンの作成
 * など
 */
const mockPrisma = createMockPrismaClient()
jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

/**
 * bcryptjsのモック
 * ----------------------------------------------------------------------------
 * bcryptjsはパスワードのハッシュ化に使うライブラリです。
 *
 * パスワードハッシュとは：
 * パスワードを不可逆な文字列に変換すること。
 * データベースに平文パスワードを保存するのは危険なので、
 * ハッシュ化して保存します。
 *
 * - hash: パスワード → ハッシュ値（例: "password" → "hashed-password"）
 * - compare: パスワードとハッシュ値を比較（ログイン時に使用）
 */
const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}
jest.mock('bcryptjs', () => mockBcrypt)

/**
 * Node.js cryptoモジュールのモック
 * ----------------------------------------------------------------------------
 * 暗号化関連の機能を提供するNode.js標準モジュール。
 *
 * - randomBytes: ランダムなバイト列を生成（トークン生成用）
 * - createHash: ハッシュ関数を作成（SHA256など）
 *
 * パスワードリセットの流れ：
 * 1. randomBytesでランダムなトークンを生成
 * 2. トークンをユーザーにメールで送信
 * 3. トークンをハッシュ化してDBに保存（セキュリティのため）
 * 4. ユーザーがトークンを使ってパスワードリセット
 */
const mockCrypto = {
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-token-123'),
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('hashed-token-123'),
    }),
  }),
}
jest.mock('crypto', () => mockCrypto)

/**
 * Next.js headersのモック
 * ----------------------------------------------------------------------------
 * HTTPリクエストのヘッダー情報を取得するNext.jsの関数。
 * IPアドレスの取得などに使用されます（レート制限、セキュリティログ用）。
 */
const mockHeaders = {
  get: jest.fn().mockReturnValue('127.0.0.1'), // ローカルホストIPを返す
}
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue(mockHeaders),
}))

/**
 * メール送信機能のモック
 * ----------------------------------------------------------------------------
 * パスワードリセットメールを送信する関数のモック。
 * 実際にはメールを送信せず、成功/失敗をシミュレートします。
 */
const mockSendPasswordResetEmail = jest.fn().mockResolvedValue({ success: true })
jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}))

/**
 * ロガーのモック
 * ----------------------------------------------------------------------------
 * アプリケーションのログ出力機能のモック。
 * テスト中にコンソールが汚れるのを防ぎます。
 *
 * __esModule: true について：
 * ESモジュールとしてインポートされることを示すフラグ。
 * default exportを持つモジュールをモックする際に必要。
 */
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

/**
 * ログイントラッカーのモック
 * ----------------------------------------------------------------------------
 * ブルートフォース攻撃（総当たり攻撃）を防ぐための機能。
 *
 * ブルートフォース攻撃とは：
 * パスワードを片っ端から試して不正ログインを試みる攻撃。
 * 対策として、一定回数以上失敗するとアカウントをロックします。
 *
 * - checkLoginAttempt: ログイン試行が許可されているかチェック
 * - recordFailedLogin: ログイン失敗を記録
 * - resetLoginAttempts: 成功時に試行回数をリセット
 * - getLoginKey: キャッシュキーの生成（IPアドレス + メールアドレス）
 */
const mockLoginTracker = {
  checkLoginAttempt: jest.fn().mockResolvedValue({
    allowed: true,        // ログイン試行が許可されている
    message: '',          // エラーメッセージなし
    remainingAttempts: 5, // 残り試行回数
  }),
  recordFailedLogin: jest.fn().mockResolvedValue({
    allowed: true,
    message: '',
    remainingAttempts: 4, // 失敗したので残り4回
  }),
  resetLoginAttempts: jest.fn().mockResolvedValue(undefined),
  getLoginKey: jest.fn().mockReturnValue('login-key'),
}
jest.mock('@/lib/login-tracker', () => mockLoginTracker)

/**
 * 入力サニタイズのモック
 * ----------------------------------------------------------------------------
 * ユーザー入力から危険な文字を除去する機能。
 * XSS（クロスサイトスクリプティング）攻撃を防ぐために重要。
 *
 * 例：<script>alert('hack')</script> → &lt;script&gt;alert('hack')&lt;/script&gt;
 *
 * このモックでは単純に入力をそのまま返します（テスト用）。
 */
jest.mock('@/lib/sanitize', () => ({
  sanitizeInput: jest.fn((input: string) => input),
}))

/**
 * セキュリティロガーのモック
 * ----------------------------------------------------------------------------
 * セキュリティ関連のイベントを記録する機能。
 * 不正アクセスの検知や監査のために使用されます。
 *
 * - logLoginFailure: ログイン失敗を記録
 * - logLoginLockout: アカウントロックを記録
 * - logRegisterSuccess: 新規登録成功を記録
 * - logPasswordResetRequest: パスワードリセット要求を記録
 * - logPasswordResetSuccess: パスワードリセット成功を記録
 */
jest.mock('@/lib/security-logger', () => ({
  logLoginFailure: jest.fn(),
  logLoginLockout: jest.fn(),
  logRegisterSuccess: jest.fn(),
  logPasswordResetRequest: jest.fn(),
  logPasswordResetSuccess: jest.fn(),
}))

// ============================================================================
// テストスイートのメイン部分
// ============================================================================
/**
 * describe()について：
 * テストをグループ化するための関数。
 * 関連するテストをまとめることで、テスト結果が読みやすくなります。
 *
 * 構造：
 * describe('機能名', () => {
 *   describe('サブ機能1', () => {
 *     it('テストケース1', () => { ... })
 *     it('テストケース2', () => { ... })
 *   })
 * })
 */
describe('Auth Actions', () => {
  /**
   * beforeEach()について：
   * 各テスト（it()）が実行される前に呼ばれる関数。
   * テスト間の独立性を保つために、モックの状態をリセットします。
   *
   * なぜリセットが必要か：
   * 前のテストでモックが特定の値を返すように設定されていると、
   * 次のテストに影響を与える可能性があるため。
   */
  beforeEach(() => {
    // jest.clearAllMocks(): すべてのモック関数の呼び出し履歴をクリア
    // 注意: mockResolvedValue等の設定はクリアされません
    jest.clearAllMocks()
  })

  // ============================================================
  // checkLoginAllowed（ログイン許可チェック）
  // ============================================================
  /**
   * checkLoginAllowed関数のテスト
   *
   * この関数は、指定されたメールアドレスでのログイン試行が
   * 許可されているかどうかをチェックします。
   *
   * ブルートフォース攻撃対策として、一定回数以上の
   * ログイン失敗があった場合はログインをブロックします。
   */
  describe('checkLoginAllowed', () => {
    /**
     * テストケース1: 正常系 - ログインが許可されている場合
     *
     * シナリオ：
     * - ユーザーがまだログイン失敗していない、または
     * - 失敗回数が上限未満の場合
     *
     * 期待結果：
     * - allowed: true（ログイン試行を許可）
     * - remainingAttempts: 残りの試行回数
     */
    it('ログインが許可されている場合、allowed: trueを返す', async () => {
      // このテストでのみ使用するモック値を設定
      // mockResolvedValueOnce: 1回だけこの値を返す
      mockLoginTracker.checkLoginAttempt.mockResolvedValueOnce({
        allowed: true,
        message: '',
        remainingAttempts: 5,
      })

      // 動的インポートを使用してテスト対象の関数を取得
      // なぜ動的インポート？
      // jest.mock()の後にインポートする必要があるため
      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('test@example.com')

      // アサーション（検証）
      // expect(値).toBe(期待値): 値が期待値と等しいことを確認
      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    /**
     * テストケース2: 異常系 - アカウントがロックされている場合
     *
     * シナリオ：
     * - ログイン失敗回数が上限に達した
     * - アカウントが一時的にロックされている
     *
     * 期待結果：
     * - allowed: false（ログイン試行を拒否）
     * - message: ロックされていることを示すメッセージ
     */
    it('ログインがロックされている場合、allowed: falseを返す', async () => {
      mockLoginTracker.checkLoginAttempt.mockResolvedValueOnce({
        allowed: false,
        message: 'アカウントがロックされています',
        remainingAttempts: 0,
      })

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('test@example.com')

      expect(result.allowed).toBe(false)
      expect(result.message).toBe('アカウントがロックされています')
    })
  })

  // ============================================================
  // recordLoginFailure（ログイン失敗の記録）
  // ============================================================
  /**
   * recordLoginFailure関数のテスト
   *
   * この関数は、ログイン失敗を記録し、
   * 残りの試行回数やロックアウト状態を返します。
   *
   * 使用タイミング：
   * - ユーザーが間違ったパスワードでログインを試みた時
   */
  describe('recordLoginFailure', () => {
    /**
     * テストケース1: ログイン失敗を記録（まだロックされていない）
     *
     * シナリオ：
     * - ユーザーがログインに失敗した
     * - まだ失敗回数が上限に達していない
     *
     * 期待結果：
     * - locked: false（まだロックされていない）
     * - remainingAttempts: 残りの試行回数（減少している）
     */
    it('ログイン失敗を記録し、残り回数を返す', async () => {
      mockLoginTracker.recordFailedLogin.mockResolvedValueOnce({
        allowed: true,
        message: '',
        remainingAttempts: 4, // 5回 → 4回に減少
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(false)
      expect(result.remainingAttempts).toBe(4)
    })

    /**
     * テストケース2: ロックアウトになった場合
     *
     * シナリオ：
     * - ログイン失敗が上限回数に達した
     * - アカウントがロックされた
     *
     * 期待結果：
     * - locked: true（ロックされた）
     * - message: ロックされたことを示すメッセージ
     */
    it('ロックアウトになった場合、locked: trueを返す', async () => {
      mockLoginTracker.recordFailedLogin.mockResolvedValueOnce({
        allowed: false,
        message: 'アカウントがロックされました',
        remainingAttempts: 0,
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(true)
      expect(result.message).toBe('アカウントがロックされました')
    })
  })

  // ============================================================
  // clearLoginAttempts（ログイン試行回数のリセット）
  // ============================================================
  /**
   * clearLoginAttempts関数のテスト
   *
   * この関数は、ログイン成功時に試行回数をリセットします。
   *
   * 使用タイミング：
   * - ユーザーが正常にログインした時
   */
  describe('clearLoginAttempts', () => {
    /**
     * テストケース: 試行回数をリセット
     *
     * シナリオ：
     * - ユーザーがログインに成功した
     * - 失敗カウンターをリセットする
     *
     * 期待結果：
     * - resetLoginAttempts関数が呼ばれる
     *
     * toHaveBeenCalled()について：
     * モック関数が呼ばれたことを確認するマッチャー。
     * 戻り値は検証せず、呼ばれたかどうかだけをチェック。
     */
    it('ログイン試行回数をリセットする', async () => {
      const { clearLoginAttempts } = await import('@/lib/actions/auth')
      await clearLoginAttempts('test@example.com')

      expect(mockLoginTracker.resetLoginAttempts).toHaveBeenCalled()
    })
  })

  // ============================================================
  // registerUser（新規ユーザー登録）
  // ============================================================
  /**
   * registerUser関数のテスト
   *
   * この関数は、新しいユーザーをデータベースに登録します。
   *
   * 処理の流れ：
   * 1. メールアドレスが既に使われていないかチェック
   * 2. パスワードをハッシュ化（bcrypt.hash）
   * 3. ユーザーをデータベースに保存
   *
   * セキュリティ考慮事項：
   * - パスワードは平文で保存せず、必ずハッシュ化する
   * - 入力値のバリデーション（形式チェック）を行う
   */
  describe('registerUser', () => {
    /**
     * テストケース1: 正常系 - 新規ユーザーを登録
     *
     * シナリオ：
     * - メールアドレスが未使用
     * - パスワードが要件を満たしている
     *
     * 期待結果：
     * - success: true
     * - userId: 作成されたユーザーのID
     * - パスワードがハッシュ化されてDBに保存される
     */
    it('新規ユーザーを登録できる', async () => {
      // 既存ユーザーが存在しない（メールアドレスが未使用）
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      // ユーザー作成が成功する
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'newuser@example.com',
        nickname: '新規ユーザー',
      })

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'newuser@example.com',
        password: 'Password123',
        nickname: '新規ユーザー',
      })

      // 成功を確認
      // toEqual(): オブジェクトの内容が等しいことを確認
      expect(result).toEqual({ success: true, userId: 'new-user-id' })

      // DBへの保存内容を確認
      // toHaveBeenCalledWith(): モック関数が特定の引数で呼ばれたことを確認
      // 注意: パスワードは'hashed-password'になっている（bcrypt.hashのモック値）
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          password: 'hashed-password', // ハッシュ化されている
          nickname: '新規ユーザー',
        },
      })
    })

    /**
     * テストケース2: 異常系 - メールアドレスが既に使用されている
     *
     * シナリオ：
     * - 同じメールアドレスのユーザーが既に存在する
     *
     * 期待結果：
     * - error: エラーメッセージ
     * - ユーザーは作成されない（user.createが呼ばれない）
     */
    it('既存のメールアドレスの場合、エラーを返す', async () => {
      // 既存ユーザーが存在する
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'test@example.com',
        password: 'Password123',
        nickname: 'テストユーザー',
      })

      // エラーが返されることを確認
      expect(result).toEqual({ error: 'このメールアドレスは既に登録されています' })

      // user.createが呼ばれていないことを確認
      // not.toHaveBeenCalled(): モック関数が呼ばれていないことを確認
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // requestPasswordReset（パスワードリセット要求）
  // ============================================================
  /**
   * requestPasswordReset関数のテスト
   *
   * この関数は、パスワードリセットのメールを送信します。
   *
   * 処理の流れ：
   * 1. ユーザーが存在するかチェック
   * 2. 古いリセットトークンを削除
   * 3. 新しいトークンを生成してDBに保存
   * 4. トークン付きのリセットURLをメールで送信
   *
   * セキュリティ考慮事項：
   * - ユーザーが存在しなくても「成功」を返す（ユーザー列挙攻撃の防止）
   * - トークンには有効期限を設定
   * - 新規リクエスト時に古いトークンを無効化
   */
  describe('requestPasswordReset', () => {
    /**
     * テストケース1: 正常系 - パスワードリセットメールを送信
     *
     * シナリオ：
     * - ユーザーが存在する
     * - メール送信が成功する
     *
     * 期待結果：
     * - success: true
     * - 古いトークンが削除される
     * - 新しいトークンが作成される
     * - メールが送信される
     */
    it('パスワードリセットメールを送信する', async () => {
      // ユーザーが存在する
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      // 古いトークンの削除が成功
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      // 新しいトークンの作成が成功
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce(mockPasswordResetToken)
      // メール送信が成功
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      // 成功を確認
      expect(result).toEqual({ success: true })

      // 古いトークンが削除されたことを確認
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })

      // 新しいトークンが作成されたことを確認
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled()

      // メールが送信されたことを確認
      expect(mockSendPasswordResetEmail).toHaveBeenCalled()
    })

    /**
     * テストケース2: ユーザーが存在しない場合でも成功を返す
     *
     * シナリオ：
     * - 入力されたメールアドレスのユーザーが存在しない
     *
     * 期待結果：
     * - success: true（攻撃者にユーザーの存在を知らせない）
     * - トークンは作成されない
     *
     * なぜ成功を返すのか？（重要なセキュリティ対策）
     * もしエラーを返すと、攻撃者は「このメールアドレスは登録されていない」
     * という情報を得られます。これを「ユーザー列挙攻撃」と呼びます。
     * 成功を返すことで、ユーザーの存在有無を隠蔽します。
     */
    it('ユーザーが存在しなくても成功を返す（セキュリティ対策）', async () => {
      // ユーザーが存在しない
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('nonexistent@example.com')

      // 成功を返す（エラーではない）
      expect(result).toEqual({ success: true })

      // トークンは作成されていない（実際の処理は行われない）
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
    })

    /**
     * テストケース3: メール送信が失敗した場合
     *
     * シナリオ：
     * - ユーザーは存在する
     * - トークン作成は成功
     * - メール送信でエラーが発生（SMTPエラーなど）
     *
     * 期待結果：
     * - error: エラーメッセージ
     */
    it('メール送信失敗時、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce(mockPasswordResetToken)
      // メール送信が失敗
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      expect(result).toEqual({ error: 'メールの送信に失敗しました。しばらく経ってからお試しください。' })
    })
  })

  // ============================================================
  // resetPassword（パスワードリセット実行）
  // ============================================================
  /**
   * resetPassword関数のテスト
   *
   * この関数は、リセットトークンを使って新しいパスワードを設定します。
   *
   * 処理の流れ：
   * 1. パスワードのバリデーション（8文字以上、英数字混合）
   * 2. トークンの有効性をチェック
   * 3. ユーザーが存在するかチェック
   * 4. 新しいパスワードをハッシュ化してDBに保存
   * 5. 使用済みトークンを削除
   *
   * パスワード要件（一般的なベストプラクティス）：
   * - 最低8文字以上
   * - アルファベットと数字を両方含む
   * - （このシステムでは実装されていないが）記号も含むとより安全
   */
  describe('resetPassword', () => {
    /**
     * テストケース1: 正常系 - パスワードのリセットに成功
     *
     * シナリオ：
     * - 有効なトークンがある
     * - ユーザーが存在する
     * - 新しいパスワードが要件を満たす
     *
     * 期待結果：
     * - success: true
     * - パスワードが更新される
     * - トークンが削除される（再利用防止）
     */
    it('パスワードをリセットする', async () => {
      // 有効なトークン（有効期限が1時間後）
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000), // 3600000ms = 1時間
      })
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, password: 'new-hashed-password' })
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'NewPassword123',
      })

      // 成功を確認
      expect(result).toEqual({ success: true })

      // パスワードが更新されたことを確認
      expect(mockPrisma.user.update).toHaveBeenCalled()

      // トークンが削除されたことを確認
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    /**
     * テストケース2: バリデーションエラー - パスワードが短すぎる
     *
     * パスワードの長さは最も基本的なセキュリティ要件。
     * 短いパスワードは総当たり攻撃に弱い。
     */
    it('8文字未満のパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'Short1', // 6文字しかない
      })

      expect(result).toEqual({ error: 'パスワードは8文字以上で入力してください' })
    })

    /**
     * テストケース3: バリデーションエラー - 数字が含まれていない
     *
     * 英字のみのパスワードは辞書攻撃に弱い。
     * 数字を含めることで複雑性が増す。
     */
    it('アルファベットのみのパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'OnlyLetters', // 数字がない
      })

      expect(result).toEqual({ error: 'パスワードはアルファベットと数字を両方含めてください' })
    })

    /**
     * テストケース4: バリデーションエラー - アルファベットが含まれていない
     *
     * 数字のみのパスワードは、桁数が少ないと
     * 総当たり攻撃で簡単に破られる。
     */
    it('数字のみのパスワードでエラーを返す', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: '12345678', // 英字がない
      })

      expect(result).toEqual({ error: 'パスワードはアルファベットと数字を両方含めてください' })
    })

    /**
     * テストケース5: 無効なトークン
     *
     * シナリオ：
     * - トークンが存在しない（間違っている）
     * - トークンの有効期限が切れている
     *
     * 攻撃者がランダムなトークンを試すことを防ぐ。
     */
    it('無効なトークンでエラーを返す', async () => {
      // トークンが見つからない
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'invalid-token',
        newPassword: 'ValidPass123',
      })

      expect(result).toEqual({ error: 'リセットリンクが無効または期限切れです。もう一度お試しください。' })
    })

    /**
     * テストケース6: ユーザーが見つからない
     *
     * シナリオ：
     * - トークンは有効だが、対応するユーザーが削除されている
     *
     * 稀なケースだが、エッジケースとしてテスト。
     */
    it('ユーザーが見つからない場合エラーを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })
      // ユーザーが存在しない
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'ValidPass123',
      })

      expect(result).toEqual({ error: 'ユーザーが見つかりません' })
    })
  })

  // ============================================================
  // verifyPasswordResetToken（トークン検証）
  // ============================================================
  /**
   * verifyPasswordResetToken関数のテスト
   *
   * この関数は、パスワードリセットトークンが有効かどうかを検証します。
   *
   * 使用タイミング：
   * - パスワードリセットページを表示する前
   * - トークンの有効性を事前にチェックしてUXを向上
   *
   * 検証内容：
   * - トークンが存在するか
   * - トークンの有効期限が切れていないか
   * - トークンとメールアドレスが一致するか
   */
  describe('verifyPasswordResetToken', () => {
    /**
     * テストケース1: 有効なトークン
     *
     * シナリオ：
     * - トークンが存在する
     * - 有効期限内
     *
     * 期待結果：
     * - valid: true
     */
    it('有効なトークンの場合、valid: trueを返す', async () => {
      // 有効期限が1時間後のトークン
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        ...mockPasswordResetToken,
        expires: new Date(Date.now() + 3600000),
      })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'valid-token')

      expect(result).toEqual({ valid: true })
    })

    /**
     * テストケース2: 無効なトークン
     *
     * シナリオ：
     * - トークンが存在しない
     * - または有効期限切れ
     *
     * 期待結果：
     * - valid: false
     */
    it('無効なトークンの場合、valid: falseを返す', async () => {
      // トークンが見つからない
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'invalid-token')

      expect(result).toEqual({ valid: false })
    })
  })
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * 1. 単一ファイルのテスト
 *    npm test -- __tests__/lib/actions/auth.test.ts
 *
 * 2. ウォッチモード（ファイル変更時に自動再実行）
 *    npm test -- --watch __tests__/lib/actions/auth.test.ts
 *
 * 3. カバレッジ付き
 *    npm test -- --coverage __tests__/lib/actions/auth.test.ts
 *
 * 4. 特定のテストだけ実行
 *    npm test -- -t "registerUser"
 */

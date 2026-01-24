/**
 * 環境対応ロギングユーティリティ
 *
 * このファイルは、開発環境と本番環境で異なる動作をするログ出力機能を提供します。
 * セキュリティとパフォーマンスを考慮し、本番環境ではコンソールログを無効化します。
 *
 * ## なぜこのファイルが必要か？
 *
 * ### 1. セキュリティの理由
 * - 本番環境でconsole.logが残っていると、ブラウザの開発者ツールで
 *   機密情報（ユーザーデータ、API構造など）が見えてしまう可能性がある
 * - 攻撃者がアプリケーションの内部構造を把握しやすくなる
 *
 * ### 2. パフォーマンスの理由
 * - console.logは同期的に実行され、大量のログはパフォーマンスに影響する
 * - 本番環境では不要なログ出力を完全に防ぐことで、わずかながら高速化できる
 *
 * ### 3. コードの一貫性
 * - console.logを直接使う代わりにloggerを使うことで、
 *   後から一括でログの動作を変更できる
 *
 * ## 使用方法
 * ```typescript
 * import { logger } from '@/lib/logger'
 *
 * // 情報ログ（開発環境のみ出力）
 * logger.log('ユーザーがログインしました', userId)
 *
 * // 警告ログ
 * logger.warn('APIレスポンスが遅延しています', responseTime)
 *
 * // エラーログ
 * logger.error('データベース接続エラー', error)
 *
 * // デバッグログ
 * logger.debug('変数の値:', { user, post, comments })
 * ```
 *
 * @module lib/logger
 */

// ============================================================
// 環境判定
// ============================================================

/**
 * 開発環境かどうかを判定するフラグ
 *
 * ## process.env.NODE_ENVとは？
 * - Node.jsの環境変数で、実行環境を示す
 * - 'development': 開発環境（npm run dev）
 * - 'production': 本番環境（npm run build && npm start）
 * - 'test': テスト環境（npm test）
 *
 * ## なぜ変数に格納するのか？
 * - 毎回process.envにアクセスするよりも効率的
 * - コードの可読性が向上する
 *
 * ## constでの宣言について
 * - 実行時に一度だけ評価され、以降は変更されない
 * - これにより、本番環境では確実にログが無効化される
 */
const isDevelopment = process.env.NODE_ENV === 'development'

// ============================================================
// ロガーオブジェクト
// ============================================================

/**
 * ログ出力を管理するオブジェクト
 *
 * ## オブジェクトリテラル形式を使う理由
 * - 関連する機能（log, warn, error, debug）をまとめて管理できる
 * - console オブジェクトと同じインターフェースで直感的に使える
 * - 名前空間を提供し、グローバルな console を汚染しない
 *
 * ## 各メソッドの共通パターン
 * ```typescript
 * methodName: (...args: unknown[]) => {
 *   if (isDevelopment) {
 *     console.xxx(...args)
 *   }
 * }
 * ```
 * - `...args: unknown[]`: 任意の数・型の引数を受け取る
 * - `isDevelopment`のチェックで本番環境では何も出力しない
 */
export const logger = {
  /**
   * 情報ログを出力（開発環境のみ）
   *
   * ## 用途
   * - 一般的な情報の記録
   * - 処理の開始・完了の通知
   * - デバッグ目的での値の確認
   *
   * ## パラメータ
   * @param args - 出力する値（任意の数・型）
   *   - `unknown[]`型: どんな型の値でも受け取れる（TypeScript推奨）
   *   - スプレッド構文で複数の引数をそのまま渡す
   *
   * ## 使用例
   * ```typescript
   * logger.log('ユーザー情報:', user)
   * logger.log('処理完了', { time: Date.now(), count: 100 })
   * ```
   */
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  /**
   * 警告ログを出力（開発環境のみ）
   *
   * ## 用途
   * - 処理は継続するが注意が必要な状況
   * - 非推奨の機能の使用
   * - パフォーマンスに影響する可能性がある処理
   *
   * ## console.warnの特徴
   * - ブラウザのコンソールで黄色い警告アイコンで表示される
   * - 視覚的に通常のログと区別しやすい
   *
   * ## 使用例
   * ```typescript
   * logger.warn('この関数は非推奨です。代わりにnewFunctionを使用してください')
   * logger.warn('APIレスポンスが3秒以上かかっています', responseTime)
   * ```
   */
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  /**
   * エラーログを出力（開発環境のみ）
   *
   * ## 用途
   * - エラーが発生した時の詳細情報
   * - try-catchブロックでキャッチしたエラー
   * - API呼び出し失敗などの例外的な状況
   *
   * ## console.errorの特徴
   * - ブラウザのコンソールで赤色のエラーアイコンで表示される
   * - スタックトレース（エラーの発生場所）が自動的に表示される
   *
   * ## 本番環境での推奨事項（TODOコメント参照）
   * 本番環境では、以下のような外部サービスにエラーを送信することを推奨：
   * - Sentry: エラートラッキングサービス
   * - Datadog: 監視・分析プラットフォーム
   * - CloudWatch Logs: AWSのログサービス
   *
   * これにより、本番環境で発生したエラーを後から調査・分析できる
   *
   * ## 使用例
   * ```typescript
   * try {
   *   await savePost(data)
   * } catch (error) {
   *   logger.error('投稿の保存に失敗しました:', error)
   *   return { error: '投稿の保存に失敗しました' }
   * }
   * ```
   */
  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error(...args)
    }

    // 本番環境では Sentry にエラーを送信
    if (!isDevelopment && typeof window !== 'undefined') {
      // クライアントサイドでのSentry送信
      import('@sentry/nextjs').then((Sentry) => {
        const error = args.find((arg) => arg instanceof Error)
        if (error) {
          Sentry.captureException(error, {
            extra: { args: args.filter((arg) => !(arg instanceof Error)) },
          })
        } else {
          Sentry.captureMessage(args.map(String).join(' '), {
            level: 'error',
            extra: { args },
          })
        }
      }).catch(() => {
        // Sentryが利用できない場合は無視
      })
    } else if (!isDevelopment) {
      // サーバーサイドでのSentry送信
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sentry = require('@sentry/nextjs')
        const error = args.find((arg) => arg instanceof Error)
        if (error) {
          Sentry.captureException(error, {
            extra: { args: args.filter((arg) => !(arg instanceof Error)) },
          })
        } else {
          Sentry.captureMessage(args.map(String).join(' '), {
            level: 'error',
            extra: { args },
          })
        }
      } catch {
        // Sentryが利用できない場合は無視
      }
    }
  },

  /**
   * デバッグログを出力（開発環境のみ）
   *
   * ## 用途
   * - 詳細なデバッグ情報
   * - 変数の中身の確認
   * - 処理フローの追跡
   *
   * ## console.debugの特徴
   * - ブラウザによっては「Verbose」レベルのログとして表示
   * - '[DEBUG]'プレフィックスを付けて、通常のログと区別しやすくしている
   *
   * ## log()との違い
   * - debug()は「デバッグ目的」であることを明示する
   * - '[DEBUG]'プレフィックスで検索・フィルタリングが容易
   * - チームメンバーが「これは一時的なデバッグログ」と認識しやすい
   *
   * ## 使用例
   * ```typescript
   * logger.debug('関数に渡された引数:', { userId, postId, content })
   * logger.debug('クエリ結果:', result)
   * logger.debug('状態の変化:', { before: oldState, after: newState })
   * ```
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args)
    }
  },
}

// ============================================================
// デフォルトエクスポート
// ============================================================

/**
 * デフォルトエクスポートとしてloggerを提供
 *
 * ## なぜ両方のエクスポートがあるのか？
 *
 * ### 名前付きエクスポート（export const logger）
 * ```typescript
 * import { logger } from '@/lib/logger'
 * ```
 * - 明示的に何をインポートしているかわかりやすい
 * - 複数の関数やオブジェクトをエクスポートする場合に適している
 *
 * ### デフォルトエクスポート（export default logger）
 * ```typescript
 * import logger from '@/lib/logger'
 * // または別名でインポート
 * import log from '@/lib/logger'
 * ```
 * - インポート時に好きな名前を付けられる
 * - モジュールのメインの機能を表す場合に適している
 *
 * ## 推奨される使い方
 * このプロジェクトでは名前付きインポートを推奨：
 * ```typescript
 * import { logger } from '@/lib/logger'
 * ```
 * - コードベース全体で一貫した名前を使用できる
 * - エディタの自動インポート機能と相性が良い
 */
export default logger

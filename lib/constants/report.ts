/**
 * 通報機能の定数定義
 *
 * このファイルは、通報（報告）機能に関する
 * 定数、型定義、設定値を提供します。
 *
 * ## 通報機能の概要
 * SNSプラットフォームでは、不適切なコンテンツやユーザーを
 * 報告する機能が必須です。このファイルでは:
 * - 通報理由の選択肢
 * - 通報対象の種類
 * - 通報状態の管理
 * - UIでの表示に使用するラベルやカラー
 * を定義しています。
 *
 * ## 自動モデレーション
 * 一定数の通報を受けたコンテンツは自動的に非表示になります。
 * これにより、明らかに問題のあるコンテンツへの迅速な対応が可能です。
 *
 * @module lib/constants/report
 */

// ============================================================
// 通報理由の定義
// ============================================================

/**
 * 通報理由の選択肢
 *
 * ## 各理由の説明
 * - spam: 宣伝目的の大量投稿、無関係な内容の繰り返し
 * - inappropriate: 公序良俗に反する内容、暴力的・性的な表現
 * - harassment: 特定個人への誹謗中傷、いじめ、差別的発言
 * - copyright: 無断転載、著作権侵害コンテンツ
 * - other: 上記に当てはまらないが問題のある内容
 *
 * ## as const の効果
 * 配列を読み取り専用にし、value を文字列リテラル型として扱う。
 *
 * ## オブジェクト構造
 * ```typescript
 * {
 *   value: 'spam',        // プログラムで使用する値
 *   label: 'スパム'       // UIで表示するラベル
 * }
 * ```
 *
 * ## 使用例
 * ```typescript
 * // セレクトボックスのオプション生成
 * REPORT_REASONS.map(reason => (
 *   <option key={reason.value} value={reason.value}>
 *     {reason.label}
 *   </option>
 * ))
 * ```
 */
export const REPORT_REASONS = [
  { value: 'spam', label: 'スパム' },
  { value: 'inappropriate', label: '不適切な内容' },
  { value: 'harassment', label: '誹謗中傷' },
  { value: 'copyright', label: '著作権侵害' },
  { value: 'other', label: 'その他' },
] as const

// ============================================================
// 型定義
// ============================================================

/**
 * 通報理由の型
 *
 * ## 型の生成方法
 * 1. typeof REPORT_REASONS → 配列全体の型
 * 2. [number] → 配列の要素の型
 * 3. ['value'] → 要素の value プロパティの型
 *
 * ## 結果の型
 * 'spam' | 'inappropriate' | 'harassment' | 'copyright' | 'other'
 *
 * ## 使用例
 * ```typescript
 * const reason: ReportReason = 'spam'  // OK
 * const reason: ReportReason = 'unknown'  // エラー！
 * ```
 */
export type ReportReason = typeof REPORT_REASONS[number]['value']

/**
 * 通報対象の種類
 *
 * ## 対象の説明
 * - post: 投稿
 * - comment: コメント
 * - event: イベント
 * - shop: 盆栽園
 * - review: レビュー
 * - user: ユーザー（アカウント自体の問題）
 *
 * ## 使用例
 * ```typescript
 * interface Report {
 *   targetType: ReportTargetType
 *   targetId: string
 *   reason: ReportReason
 * }
 * ```
 */
export type ReportTargetType = 'post' | 'comment' | 'event' | 'shop' | 'review' | 'user'

/**
 * 通報のステータス
 *
 * ## 状態遷移
 * ```
 * pending（保留中）
 *    ↓
 * reviewed（確認済み）
 *    ↓
 * resolved（解決済み）または dismissed（却下）
 * ```
 *
 * ## 各状態の説明
 * - pending: 新規通報、まだ確認されていない
 * - reviewed: 管理者が確認中
 * - resolved: 対応完了（コンテンツ削除など）
 * - dismissed: 問題なしと判断され却下
 * - auto_hidden: 自動非表示（しきい値超過）
 *
 * ## auto_hidden について
 * AUTO_HIDE_THRESHOLD を超える通報があった場合、
 * 自動的にこの状態に設定され、コンテンツが非表示になります。
 */
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'auto_hidden'

// ============================================================
// 定数値
// ============================================================

/**
 * 自動非表示のしきい値
 *
 * ## 機能概要
 * 同じコンテンツに対してこの数以上の通報があると、
 * 管理者の確認を待たずに自動的に非表示になります。
 *
 * ## 設計意図
 * - 明らかに問題のあるコンテンツへの迅速な対応
 * - 管理者の負担軽減
 * - ユーザー保護
 *
 * ## 値の根拠
 * 10件という値は:
 * - 少なすぎると誤判定のリスクが高い
 * - 多すぎると対応が遅れる
 * - 複数の異なるユーザーからの通報が必要
 *
 * ## 使用例
 * ```typescript
 * const reportCount = await prisma.report.count({
 *   where: { targetId, targetType }
 * })
 *
 * if (reportCount >= AUTO_HIDE_THRESHOLD) {
 *   await hideContent(targetId, targetType)
 * }
 * ```
 */
export const AUTO_HIDE_THRESHOLD = 10

// ============================================================
// コンテンツタイプ定義（userを除く）
// ============================================================

/**
 * コンテンツタイプの型（userを除く）
 *
 * ## ReportTargetType との違い
 * ReportTargetType には 'user' が含まれますが、
 * ContentType にはコンテンツのみが含まれます。
 *
 * ## なぜ分けているか？
 * - ユーザーはコンテンツではなくアカウント
 * - コンテンツの非表示処理とユーザーのBANは別処理
 * - UIでの表示やフィルタリングが異なる
 *
 * ## 使用場面
 * - コンテンツ一覧の表示
 * - コンテンツの非表示処理
 * - 管理画面でのフィルタリング
 */
export type ContentType = 'post' | 'comment' | 'event' | 'shop' | 'review'

// ============================================================
// UIラベル定義
// ============================================================

/**
 * 通報対象タイプの日本語ラベル
 *
 * ## Record<K, V> 型
 * キーが K 型、値が V 型のオブジェクトを定義。
 * Record<ReportTargetType, string> は:
 * - キー: ReportTargetType の各値
 * - 値: string（日本語ラベル）
 *
 * ## 使用例
 * ```typescript
 * // 通報詳細画面での表示
 * const typeLabel = TARGET_TYPE_LABELS[report.targetType]
 * // 「投稿」「コメント」などが返る
 * ```
 */
export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
  user: 'ユーザー',
}

/**
 * コンテンツタイプの日本語ラベル（userを除く）
 *
 * ## TARGET_TYPE_LABELS との違い
 * 'user' キーを含まないため、コンテンツのみを扱う場面で使用。
 *
 * ## 使用例
 * ```typescript
 * // コンテンツタイプのセレクトボックス
 * Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
 *   <option key={value} value={value}>{label}</option>
 * ))
 * ```
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
}

/**
 * コンテンツタイプごとのバッジカラー
 *
 * ## Tailwind CSS クラス
 * 各コンテンツタイプを色で区別するためのCSSクラス。
 * バッジ（ラベル）表示に使用します。
 *
 * ## カラー設計
 * - post（投稿）: 青 - 最も一般的なコンテンツ
 * - comment（コメント）: 緑 - 肯定的な印象
 * - event（イベント）: 紫 - 特別感
 * - shop（盆栽園）: 琥珀 - 温かみのある印象
 * - review（レビュー）: ピンク - 評価・感想の印象
 *
 * ## クラスの構成
 * `bg-{color}-100`: 薄い背景色
 * `text-{color}-800`: 濃い文字色
 *
 * ## 使用例
 * ```typescript
 * // バッジコンポーネント
 * <span className={`px-2 py-1 rounded ${CONTENT_TYPE_COLORS[contentType]}`}>
 *   {CONTENT_TYPE_LABELS[contentType]}
 * </span>
 * ```
 */
export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  post: 'bg-blue-100 text-blue-800',
  comment: 'bg-green-100 text-green-800',
  event: 'bg-purple-100 text-purple-800',
  shop: 'bg-amber-100 text-amber-800',
  review: 'bg-pink-100 text-pink-800',
}

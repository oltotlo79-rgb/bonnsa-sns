// 通報理由
export const REPORT_REASONS = [
  { value: 'spam', label: 'スパム' },
  { value: 'inappropriate', label: '不適切な内容' },
  { value: 'harassment', label: '誹謗中傷' },
  { value: 'copyright', label: '著作権侵害' },
  { value: 'other', label: 'その他' },
] as const

export type ReportReason = typeof REPORT_REASONS[number]['value']
export type ReportTargetType = 'post' | 'comment' | 'event' | 'shop' | 'review' | 'user'
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'auto_hidden'

// 自動非表示のしきい値
export const AUTO_HIDE_THRESHOLD = 10

// コンテンツタイプ（userを除く）
export type ContentType = 'post' | 'comment' | 'event' | 'shop' | 'review'

// コンテンツタイプのラベル（日本語表示用）
export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
  user: 'ユーザー',
}

// コンテンツタイプのラベル（userを除く）
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: '投稿',
  comment: 'コメント',
  event: 'イベント',
  shop: '盆栽園',
  review: 'レビュー',
}

// コンテンツタイプのカラー（バッジ表示用）
export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  post: 'bg-blue-100 text-blue-800',
  comment: 'bg-green-100 text-green-800',
  event: 'bg-purple-100 text-purple-800',
  shop: 'bg-amber-100 text-amber-800',
  review: 'bg-pink-100 text-pink-800',
}

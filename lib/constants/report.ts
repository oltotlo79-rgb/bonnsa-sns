// 通報理由
export const REPORT_REASONS = [
  { value: 'spam', label: 'スパム' },
  { value: 'inappropriate', label: '不適切な内容' },
  { value: 'harassment', label: '誹謗中傷' },
  { value: 'copyright', label: '著作権侵害' },
  { value: 'other', label: 'その他' },
] as const

export type ReportReason = typeof REPORT_REASONS[number]['value']
export type ReportTargetType = 'post' | 'comment' | 'event' | 'shop' | 'user'
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed'

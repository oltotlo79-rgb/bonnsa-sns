// サーバーサイド互換のサニタイズ関数
// isomorphic-dompurifyはVercelで動作しないため、シンプルな実装を使用

// HTMLタグを除去する関数
function stripHtmlTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // scriptタグを除去
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // styleタグを除去
    .replace(/<[^>]+>/g, '') // 全てのHTMLタグを除去
}

// HTMLエンティティをデコード
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// 特殊文字をエスケープ
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// テキストコンテンツのサニタイズ（HTMLタグを完全に除去）
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const stripped = stripHtmlTags(input)

  // HTMLエンティティをデコード
  const decoded = decodeHtmlEntities(stripped)

  // 再度エスケープして安全なテキストに
  return escapeHtml(decoded)
}

// 基本的なHTMLを許可するサニタイズ（リッチテキスト用）
// 注意: サーバーサイドでは安全のためHTMLを除去
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''

  // サーバーサイドでは安全のためHTMLタグを除去
  return stripHtmlTags(input)
}

// URLのサニタイズ
export function sanitizeUrl(input: string | null | undefined): string {
  if (!input) return ''

  const trimmed = input.trim()

  // 許可されたプロトコルのみ
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']

  try {
    const url = new URL(trimmed)
    if (!allowedProtocols.includes(url.protocol)) {
      return ''
    }
    return url.href
  } catch {
    // 相対URLの場合はそのまま返す（/から始まるパス）
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed
    }
    return ''
  }
}

// ニックネームのサニタイズ（特殊文字を制限）
export function sanitizeNickname(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  // 制御文字を除去
  const withoutControl = withoutHtml.replace(/[\x00-\x1F\x7F]/g, '')

  // 先頭・末尾の空白を除去
  return withoutControl.trim()
}

// 検索クエリのサニタイズ
export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  // SQLインジェクション対策（基本的なパターン）
  // 注: Prismaは既にパラメータ化クエリを使用しているため、これは追加の安全対策
  const sanitized = withoutHtml
    .replace(/[;'"\\]/g, '') // 危険な文字を除去
    .replace(/--/g, '') // SQLコメントを除去
    .trim()

  return sanitized
}

// ファイル名のサニタイズ
export function sanitizeFilename(input: string | null | undefined): string {
  if (!input) return 'file'

  // パス区切り文字と危険な文字を除去
  const sanitized = input
    .replace(/[/\\:*?"<>|]/g, '') // ファイルシステムで禁止されている文字
    .replace(/\.\./g, '') // ディレクトリトラバーサル防止
    .replace(/^\.+/, '') // 先頭のドットを除去（隠しファイル防止）
    .trim()

  return sanitized || 'file'
}

// 投稿コンテンツのサニタイズ
export function sanitizePostContent(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  // 過度な改行を制限（連続3つ以上の改行を2つに）
  const normalizedNewlines = withoutHtml.replace(/\n{3,}/g, '\n\n')

  // 先頭・末尾の空白を除去
  return normalizedNewlines.trim()
}

// 一般的なユーザー入力のサニタイズ
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  // 制御文字を除去（改行・タブは許可）
  const withoutControl = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return withoutControl.trim()
}

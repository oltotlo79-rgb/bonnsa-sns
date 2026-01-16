import DOMPurify from 'isomorphic-dompurify'

// テキストコンテンツのサニタイズ（HTMLタグを完全に除去）
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''

  // DOMPurifyでHTMLを除去し、純粋なテキストのみを返す
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // HTMLタグを全て除去
    ALLOWED_ATTR: [], // 属性も全て除去
  })

  // 追加の安全対策：特殊文字をエスケープ
  return sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// 基本的なHTMLを許可するサニタイズ（リッチテキスト用）
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // リンクにtarget属性を許可
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  })
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
  const withoutHtml = sanitizeText(input)

  // 制御文字を除去
  const withoutControl = withoutHtml.replace(/[\x00-\x1F\x7F]/g, '')

  // 先頭・末尾の空白を除去
  return withoutControl.trim()
}

// 検索クエリのサニタイズ
export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = sanitizeText(input)

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

  // HTMLタグを除去し、テキストのみを返す
  const withoutHtml = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })

  // 過度な改行を制限（連続3つ以上の改行を2つに）
  const normalizedNewlines = withoutHtml.replace(/\n{3,}/g, '\n\n')

  // 先頭・末尾の空白を除去
  return normalizedNewlines.trim()
}

// 一般的なユーザー入力のサニタイズ
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = sanitizeText(input)

  // 制御文字を除去（改行・タブは許可）
  const withoutControl = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return withoutControl.trim()
}

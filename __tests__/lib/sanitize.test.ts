/**
 * @jest-environment node
 */

import {
  sanitizeText,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeNickname,
  sanitizeSearchQuery,
  sanitizeFilename,
  sanitizePostContent,
  sanitizeInput,
} from '@/lib/sanitize'

describe('Sanitize Module', () => {
  describe('sanitizeText', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizeText(null)).toBe('')
      expect(sanitizeText(undefined)).toBe('')
    })

    it('scriptタグを除去する', () => {
      const input = '<script>alert("xss")</script>Hello'
      const result = sanitizeText(input)
      expect(result).not.toContain('script')
      expect(result).toContain('Hello')
    })

    it('styleタグを除去する', () => {
      const input = '<style>body { display: none; }</style>Content'
      const result = sanitizeText(input)
      expect(result).not.toContain('style')
      expect(result).toContain('Content')
    })

    it('HTMLタグを除去する', () => {
      const input = '<div><p>Hello</p><a href="test">World</a></div>'
      const result = sanitizeText(input)
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })

    it('特殊文字をエスケープする', () => {
      // HTMLタグとして解釈されない形式でテスト
      const input = 'A &amp; B'
      const result = sanitizeText(input)
      expect(result).toContain('&amp;')
    })

    it('&文字をエスケープする', () => {
      const input = 'Tom & Jerry'
      const result = sanitizeText(input)
      expect(result).toBe('Tom &amp; Jerry')
    })

    it('HTMLエンティティをデコードしてから再エスケープする', () => {
      const input = '&lt;script&gt;alert()&lt;/script&gt;'
      const result = sanitizeText(input)
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
    })

    it('クォートをエスケープする', () => {
      const input = 'He said "Hello" and \'World\''
      const result = sanitizeText(input)
      expect(result).toContain('&quot;')
      expect(result).toContain('&#x27;')
    })
  })

  describe('sanitizeHtml', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizeHtml(null)).toBe('')
      expect(sanitizeHtml(undefined)).toBe('')
    })

    it('HTMLタグを除去する', () => {
      const input = '<b>Bold</b> and <i>italic</i>'
      const result = sanitizeHtml(input)
      expect(result).toBe('Bold and italic')
    })

    it('scriptタグを完全に除去する', () => {
      const input = 'Before<script>malicious()</script>After'
      const result = sanitizeHtml(input)
      expect(result).toBe('BeforeAfter')
    })
  })

  describe('sanitizeUrl', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizeUrl(null)).toBe('')
      expect(sanitizeUrl(undefined)).toBe('')
    })

    it('http URLを許可する', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/')
    })

    it('https URLを許可する', () => {
      expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path')
    })

    it('mailto URLを許可する', () => {
      expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com')
    })

    it('tel URLを許可する', () => {
      expect(sanitizeUrl('tel:+81-90-1234-5678')).toBe('tel:+81-90-1234-5678')
    })

    it('javascript URLを拒否する', () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBe('')
    })

    it('data URLを拒否する', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    })

    it('file URLを拒否する', () => {
      expect(sanitizeUrl('file:///etc/passwd')).toBe('')
    })

    it('相対URLを許可する', () => {
      expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page')
    })

    it('プロトコル相対URLを拒否する', () => {
      expect(sanitizeUrl('//evil.com/script.js')).toBe('')
    })

    it('無効なURLは空文字を返す', () => {
      expect(sanitizeUrl('not a valid url')).toBe('')
    })

    it('前後の空白をトリムする', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com/')
    })
  })

  describe('sanitizeNickname', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizeNickname(null)).toBe('')
      expect(sanitizeNickname(undefined)).toBe('')
    })

    it('HTMLタグを除去する', () => {
      expect(sanitizeNickname('<b>User</b>')).toBe('User')
    })

    it('制御文字を除去する', () => {
      expect(sanitizeNickname('User\x00\x01\x02Name')).toBe('UserName')
    })

    it('改行を除去する', () => {
      expect(sanitizeNickname('User\nName')).toBe('UserName')
    })

    it('タブを除去する', () => {
      expect(sanitizeNickname('User\tName')).toBe('UserName')
    })

    it('前後の空白を除去する', () => {
      expect(sanitizeNickname('  Username  ')).toBe('Username')
    })

    it('日本語のニックネームを許可する', () => {
      expect(sanitizeNickname('盆栽太郎')).toBe('盆栽太郎')
    })
  })

  describe('sanitizeSearchQuery', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizeSearchQuery(null)).toBe('')
      expect(sanitizeSearchQuery(undefined)).toBe('')
    })

    it('HTMLタグを除去する', () => {
      expect(sanitizeSearchQuery('<script>alert()</script>query')).toBe('query')
    })

    it('セミコロンを除去する', () => {
      expect(sanitizeSearchQuery('test; DROP TABLE users')).toBe('test DROP TABLE users')
    })

    it('クォートを除去する', () => {
      expect(sanitizeSearchQuery("test' OR '1'='1")).toBe('test OR 1=1')
    })

    it('バックスラッシュを除去する', () => {
      expect(sanitizeSearchQuery('test\\ninjection')).toBe('testninjection')
    })

    it('SQLコメントを除去する', () => {
      expect(sanitizeSearchQuery('test -- comment')).toBe('test  comment')
    })

    it('前後の空白を除去する', () => {
      expect(sanitizeSearchQuery('  search term  ')).toBe('search term')
    })

    it('日本語検索クエリを許可する', () => {
      expect(sanitizeSearchQuery('黒松 盆栽')).toBe('黒松 盆栽')
    })
  })

  describe('sanitizeFilename', () => {
    it('nullまたはundefinedの場合はfileを返す', () => {
      expect(sanitizeFilename(null)).toBe('file')
      expect(sanitizeFilename(undefined)).toBe('file')
    })

    it('ディレクトリトラバーサルを防止する', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd')
    })

    it('禁止文字を除去する', () => {
      expect(sanitizeFilename('file:name*with?bad<chars>')).toBe('filenamewithbadchars')
    })

    it('先頭のドットを除去する', () => {
      expect(sanitizeFilename('.htaccess')).toBe('htaccess')
      expect(sanitizeFilename('...hidden')).toBe('hidden')
    })

    it('パス区切りを除去する', () => {
      expect(sanitizeFilename('path/to\\file.txt')).toBe('pathtofile.txt')
    })

    it('空になった場合はfileを返す', () => {
      expect(sanitizeFilename('...')).toBe('file')
      expect(sanitizeFilename('   ')).toBe('file')
    })

    it('正常なファイル名はそのまま返す', () => {
      expect(sanitizeFilename('image.jpg')).toBe('image.jpg')
      expect(sanitizeFilename('document_2024.pdf')).toBe('document_2024.pdf')
    })

    it('日本語ファイル名を許可する', () => {
      expect(sanitizeFilename('画像.png')).toBe('画像.png')
    })
  })

  describe('sanitizePostContent', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizePostContent(null)).toBe('')
      expect(sanitizePostContent(undefined)).toBe('')
    })

    it('HTMLタグを除去する', () => {
      expect(sanitizePostContent('<script>alert()</script>投稿内容')).toBe('投稿内容')
    })

    it('過度な改行を制限する', () => {
      const input = 'Line1\n\n\n\n\nLine2'
      const result = sanitizePostContent(input)
      expect(result).toBe('Line1\n\nLine2')
    })

    it('2つの改行は許可する', () => {
      const input = 'Line1\n\nLine2'
      expect(sanitizePostContent(input)).toBe('Line1\n\nLine2')
    })

    it('前後の空白を除去する', () => {
      expect(sanitizePostContent('  投稿内容  ')).toBe('投稿内容')
    })

    it('ハッシュタグを保持する', () => {
      expect(sanitizePostContent('#盆栽 #黒松')).toBe('#盆栽 #黒松')
    })

    it('メンションを保持する', () => {
      expect(sanitizePostContent('@user さんへ')).toBe('@user さんへ')
    })
  })

  describe('sanitizeInput', () => {
    it('nullまたはundefinedの場合は空文字を返す', () => {
      expect(sanitizeInput(null)).toBe('')
      expect(sanitizeInput(undefined)).toBe('')
    })

    it('HTMLタグを除去する', () => {
      expect(sanitizeInput('<div>content</div>')).toBe('content')
    })

    it('改行とタブを許可する', () => {
      const input = 'Line1\nLine2\tTabbed'
      expect(sanitizeInput(input)).toBe('Line1\nLine2\tTabbed')
    })

    it('NULL文字を除去する', () => {
      expect(sanitizeInput('text\x00with\x00nulls')).toBe('textwithnulls')
    })

    it('その他の制御文字を除去する', () => {
      expect(sanitizeInput('text\x01\x02\x03content')).toBe('textcontent')
    })

    it('垂直タブとフォームフィードを除去する', () => {
      expect(sanitizeInput('text\x0B\x0Ccontent')).toBe('textcontent')
    })

    it('前後の空白を除去する', () => {
      expect(sanitizeInput('  content  ')).toBe('content')
    })
  })
})

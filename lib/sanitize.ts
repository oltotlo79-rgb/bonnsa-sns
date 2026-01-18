/**
 * 入力サニタイズユーティリティ
 *
 * このファイルは、ユーザー入力をサニタイズ（無害化）するための関数を提供します。
 * XSS（クロスサイトスクリプティング）攻撃やSQLインジェクション攻撃を防止します。
 *
 * ## なぜサニタイズが必要か？
 *
 * ### XSS攻撃とは？
 * 悪意のあるユーザーがHTMLやJavaScriptをフォームに入力し、
 * 他のユーザーのブラウザで実行させる攻撃
 *
 * ### 攻撃例
 * ```html
 * <!-- ユーザーが投稿に以下を入力 -->
 * <script>document.cookie を外部サーバーに送信</script>
 *
 * <!-- サニタイズしないと、他のユーザーがこの投稿を見た時に実行される -->
 * ```
 *
 * ## なぜisomorphic-dompurifyを使わないか？
 * - DOMPurifyはブラウザ環境を前提としている
 * - Vercelのサーバーレス環境では動作しない場合がある
 * - シンプルな正規表現ベースの実装で十分なケースが多い
 *
 * ## このファイルが提供する関数
 * - sanitizeText: 一般的なテキストの無害化
 * - sanitizeHtml: リッチテキストの無害化
 * - sanitizeUrl: URLの検証と無害化
 * - sanitizeNickname: ニックネームの無害化
 * - sanitizeSearchQuery: 検索クエリの無害化
 * - sanitizeFilename: ファイル名の無害化
 * - sanitizePostContent: 投稿コンテンツの無害化
 * - sanitizeInput: 一般的な入力の無害化
 *
 * @module lib/sanitize
 */

// ============================================================
// 内部ヘルパー関数
// ============================================================

/**
 * HTMLタグを除去する関数
 *
 * ## 処理内容
 * 1. <script>タグを完全に除去（中身も含む）
 * 2. <style>タグを完全に除去（中身も含む）
 * 3. その他すべてのHTMLタグを除去
 *
 * ## 正規表現の解説
 *
 * ### scriptタグ除去
 * `/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi`
 * - `<script\b`: <script で始まり、境界（スペースや >）が続く
 * - `[^<]*`: < 以外の任意の文字（属性など）
 * - `(?:(?!<\/script>)<[^<]*)*`: </script> 以外の < を含む内容
 * - `<\/script>`: 閉じタグ
 * - `gi`: グローバル（全て）、大文字小文字無視
 *
 * ### styleタグ除去
 * 同様のパターンでstyleタグを除去
 *
 * ### その他のタグ除去
 * `/<[^>]+>/g`
 * - `<`: 開始 <
 * - `[^>]+`: > 以外の1文字以上
 * - `>`: 終了 >
 *
 * @param input - サニタイズ対象の文字列
 * @returns HTMLタグを除去した文字列
 */
function stripHtmlTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // scriptタグを除去
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // styleタグを除去
    .replace(/<[^>]+>/g, '') // 全てのHTMLタグを除去
}

/**
 * HTMLエンティティをデコードする関数
 *
 * ## HTMLエンティティとは？
 * HTMLで特殊な意味を持つ文字を安全に表示するための表記法
 * 例: `<` → `&lt;`、`>` → `&gt;`
 *
 * ## なぜデコードが必要か？
 * - タグ除去後、エンティティはそのまま残る
 * - ユーザーに表示する際に正しい文字に戻す必要がある
 *
 * ## 対応エンティティ
 * - &amp; → & (アンパサンド)
 * - &lt; → < (小なり)
 * - &gt; → > (大なり)
 * - &quot; → " (二重引用符)
 * - &#x27; → ' (アポストロフィ、16進数表記)
 * - &#39; → ' (アポストロフィ、10進数表記)
 * - &nbsp; → ' ' (ノーブレークスペース)
 *
 * @param input - デコード対象の文字列
 * @returns デコードされた文字列
 */
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

/**
 * 特殊文字をHTMLエンティティにエスケープする関数
 *
 * ## なぜエスケープが必要か？
 * - HTMLとして解釈される可能性のある文字を無害化
 * - ブラウザがタグとして認識しないようにする
 *
 * ## 変換ルール
 * - & → &amp; (最初に変換、他のエンティティと競合防止)
 * - < → &lt;
 * - > → &gt;
 * - " → &quot;
 * - ' → &#x27;
 *
 * ## 順序の重要性
 * `&` を最初に変換する必要がある
 * 例: `<` → `&lt;` の後に `&` → `&amp;` すると
 * `&lt;` が `&amp;lt;` になってしまう
 *
 * @param input - エスケープ対象の文字列
 * @returns エスケープされた文字列
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ============================================================
// 公開関数
// ============================================================

/**
 * テキストコンテンツのサニタイズ
 *
 * ## 用途
 * - 一般的なテキスト入力の無害化
 * - HTMLを完全に除去したい場合
 *
 * ## 処理フロー
 * 1. HTMLタグを除去
 * 2. HTMLエンティティをデコード（元の文字に戻す）
 * 3. 再度エスケープ（安全な表示用に変換）
 *
 * ## なぜデコード→再エスケープ？
 * - 既存のエンティティを一度デコードして正規化
 * - 統一されたエスケープ処理を適用
 *
 * @param input - サニタイズ対象の文字列（null/undefined可）
 * @returns サニタイズされた安全な文字列
 *
 * ## 使用例
 * ```typescript
 * sanitizeText('<script>alert("xss")</script>Hello')
 * // 結果: 'Hello'
 *
 * sanitizeText('A < B && C > D')
 * // 結果: 'A &lt; B &amp;&amp; C &gt; D'
 * ```
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const stripped = stripHtmlTags(input)

  // HTMLエンティティをデコード
  const decoded = decodeHtmlEntities(stripped)

  // 再度エスケープして安全なテキストに
  return escapeHtml(decoded)
}

/**
 * 基本的なHTMLを許可するサニタイズ（リッチテキスト用）
 *
 * ## 用途
 * - リッチテキストエディタからの入力
 * - 一部のHTMLを許可したい場合
 *
 * ## 現在の実装
 * サーバーサイドでは安全のためHTMLを完全に除去
 * 将来的にはホワイトリスト方式で安全なタグのみ許可することも可能
 *
 * ## 注意
 * クライアントサイドでDOMPurifyを使用する場合は、
 * そちらでより詳細な制御が可能
 *
 * @param input - サニタイズ対象の文字列
 * @returns HTMLタグを除去した文字列
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''

  // サーバーサイドでは安全のためHTMLタグを除去
  return stripHtmlTags(input)
}

/**
 * URLのサニタイズと検証
 *
 * ## 用途
 * - ユーザーが入力したURLの検証
 * - リンクの安全性確保
 *
 * ## 許可されるプロトコル
 * - http: 通常のHTTP
 * - https: セキュアなHTTP
 * - mailto: メールリンク
 * - tel: 電話リンク
 *
 * ## 拒否されるプロトコル
 * - javascript: XSS攻撃に使用される
 * - data: XSS攻撃に使用される可能性がある
 * - file: ローカルファイルアクセス
 *
 * @param input - 検証対象のURL文字列
 * @returns 有効なURLまたは空文字列
 *
 * ## 使用例
 * ```typescript
 * sanitizeUrl('https://example.com')
 * // 結果: 'https://example.com'
 *
 * sanitizeUrl('javascript:alert("xss")')
 * // 結果: '' (拒否)
 *
 * sanitizeUrl('/path/to/page')
 * // 結果: '/path/to/page' (相対URL許可)
 * ```
 */
export function sanitizeUrl(input: string | null | undefined): string {
  if (!input) return ''

  const trimmed = input.trim()

  // 許可されたプロトコルのみ
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']

  try {
    /**
     * URLコンストラクタで解析
     *
     * 有効なURLの場合、プロトコルをチェック
     * 無効な場合は例外がスローされる
     */
    const url = new URL(trimmed)
    if (!allowedProtocols.includes(url.protocol)) {
      return ''
    }
    // 正規化されたURLを返す
    return url.href
  } catch {
    /**
     * 相対URLの処理
     *
     * URLコンストラクタは絶対URLのみ受け付けるため、
     * 相対URL（/から始まるパス）は手動で処理
     *
     * // で始まるURLは拒否（プロトコル相対URL）
     * 例: //evil.com/script.js
     */
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed
    }
    return ''
  }
}

/**
 * ニックネームのサニタイズ
 *
 * ## 用途
 * - ユーザー名/ニックネームの入力
 * - 表示名のクリーンアップ
 *
 * ## 処理内容
 * 1. HTMLタグを除去
 * 2. 制御文字を除去
 * 3. 前後の空白を除去
 *
 * ## 制御文字とは？
 * - 0x00-0x1F: ASCII制御文字（改行、タブ等含む）
 * - 0x7F: DEL文字
 *
 * ## 注意
 * この関数では改行やタブも除去される
 * ニックネームは1行のテキストを想定
 *
 * @param input - サニタイズ対象のニックネーム
 * @returns クリーンなニックネーム
 */
export function sanitizeNickname(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  /**
   * 制御文字を除去
   *
   * 正規表現: /[\x00-\x1F\x7F]/g
   * - \x00-\x1F: 0〜31のASCII制御文字
   * - \x7F: DEL文字（127）
   */
  const withoutControl = withoutHtml.replace(/[\x00-\x1F\x7F]/g, '')

  // 先頭・末尾の空白を除去
  return withoutControl.trim()
}

/**
 * 検索クエリのサニタイズ
 *
 * ## 用途
 * - 検索ボックスからの入力
 * - データベースクエリに使用する文字列
 *
 * ## SQLインジェクション対策
 * Prismaは既にパラメータ化クエリを使用しているため、
 * SQLインジェクションは基本的に防がれている
 * この処理は追加の安全対策
 *
 * ## 除去される文字
 * - ; (セミコロン): ステートメント区切り
 * - ' (シングルクォート): 文字列リテラル
 * - " (ダブルクォート): 文字列リテラル
 * - \ (バックスラッシュ): エスケープ文字
 * - -- : SQLコメント
 *
 * @param input - サニタイズ対象の検索クエリ
 * @returns 安全な検索クエリ
 */
export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  /**
   * SQLインジェクション対策
   *
   * 危険な文字とパターンを除去
   * 注: Prismaは既にパラメータ化クエリを使用しているため、これは追加の安全対策
   */
  const sanitized = withoutHtml
    .replace(/[;'"\\]/g, '') // 危険な文字を除去
    .replace(/--/g, '') // SQLコメントを除去
    .trim()

  return sanitized
}

/**
 * ファイル名のサニタイズ
 *
 * ## 用途
 * - アップロードされたファイルの名前
 * - ダウンロードファイル名の生成
 *
 * ## セキュリティリスク
 *
 * ### ディレクトリトラバーサル
 * `../../../etc/passwd` のようなパスでシステムファイルにアクセス
 *
 * ### 特殊ファイル名
 * `.htaccess`, `.env` などの隠しファイル/設定ファイル
 *
 * ## 除去される文字
 * - / \ : * ? " < > | : ファイルシステムで禁止
 * - .. : ディレクトリトラバーサル防止
 * - 先頭のドット: 隠しファイル防止
 *
 * @param input - サニタイズ対象のファイル名
 * @returns 安全なファイル名（空の場合は 'file'）
 */
export function sanitizeFilename(input: string | null | undefined): string {
  if (!input) return 'file'

  /**
   * 危険なパターンを除去
   */
  const sanitized = input
    .replace(/[/\\:*?"<>|]/g, '') // ファイルシステムで禁止されている文字
    .replace(/\.\./g, '') // ディレクトリトラバーサル防止
    .replace(/^\.+/, '') // 先頭のドットを除去（隠しファイル防止）
    .trim()

  // 空になった場合はデフォルト名を返す
  return sanitized || 'file'
}

/**
 * 投稿コンテンツのサニタイズ
 *
 * ## 用途
 * - SNS投稿本文
 * - コメント内容
 *
 * ## 処理内容
 * 1. HTMLタグを除去
 * 2. 過度な改行を制限（連続3つ以上→2つ）
 * 3. 前後の空白を除去
 *
 * ## なぜ改行を制限するか？
 * - スパム的な投稿を防止
 * - UI表示の崩れを防止
 * - 読みやすさの維持
 *
 * @param input - サニタイズ対象の投稿コンテンツ
 * @returns クリーンな投稿コンテンツ
 */
export function sanitizePostContent(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  /**
   * 過度な改行を制限
   *
   * 正規表現: /\n{3,}/g
   * - \n{3,}: 3つ以上連続する改行
   * - 置換: \n\n（2つの改行に正規化）
   */
  const normalizedNewlines = withoutHtml.replace(/\n{3,}/g, '\n\n')

  // 先頭・末尾の空白を除去
  return normalizedNewlines.trim()
}

/**
 * 一般的なユーザー入力のサニタイズ
 *
 * ## 用途
 * - 特定のサニタイズ関数がない場合の汎用処理
 * - 各種フォーム入力
 *
 * ## 処理内容
 * 1. HTMLタグを除去
 * 2. 制御文字を除去（改行・タブは許可）
 * 3. 前後の空白を除去
 *
 * ## sanitizeTextとの違い
 * - sanitizeText: HTMLエスケープまで行う（表示用）
 * - sanitizeInput: タグ除去と制御文字除去のみ（保存用）
 *
 * @param input - サニタイズ対象の入力
 * @returns クリーンな入力
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return ''

  // HTMLタグを除去
  const withoutHtml = stripHtmlTags(input)

  /**
   * 制御文字を除去（改行・タブは許可）
   *
   * 正規表現: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
   * - \x00-\x08: NULL〜バックスペース
   * - \x0B: 垂直タブ（除去）
   * - \x0C: フォームフィード（除去）
   * - \x0E-\x1F: その他の制御文字
   * - \x7F: DEL文字
   *
   * 許可される制御文字:
   * - \x09 (0x09): 水平タブ
   * - \x0A (0x0A): 改行（LF）
   * - \x0D (0x0D): キャリッジリターン（CR）
   */
  const withoutControl = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return withoutControl.trim()
}

/**
 * @file JsonLd.tsx
 * @description JSON-LD構造化データコンポーネント集
 *
 * このファイルには、SEO向けのJSON-LD（Linked Data）構造化データを
 * 出力するためのコンポーネント群が含まれています。
 * これらのコンポーネントをページに配置することで、検索エンジンに
 * コンテンツの意味的な情報を伝えることができます。
 *
 * @features
 * - Organization: 組織情報
 * - LocalBusiness: ローカルビジネス（盆栽園）情報
 * - Event: イベント情報
 * - Article: 記事（投稿）情報
 * - Breadcrumb: パンくずリスト
 * - WebSite: ウェブサイト情報（サイト内検索対応）
 *
 * @usage
 * ```tsx
 * // 組織情報（ルートレイアウト）
 * <OrganizationJsonLd
 *   name="BON-LOG"
 *   url="https://bon-log.com"
 *   logo="https://bon-log.com/logo.png"
 * />
 *
 * // 盆栽園ページ
 * <LocalBusinessJsonLd
 *   name="〇〇盆栽園"
 *   address="東京都..."
 *   url="https://bon-log.com/shops/xxx"
 * />
 * ```
 *
 * @see https://schema.org/ - Schema.org公式ドキュメント
 * @see https://developers.google.com/search/docs/appearance/structured-data - Google構造化データガイド
 */

// ============================================================
// Organization（組織）
// ============================================================

/**
 * OrganizationJsonLdコンポーネントのプロパティ定義
 */
interface OrganizationJsonLdProps {
  /** 組織名 */
  name: string
  /** 組織のウェブサイトURL */
  url: string
  /** ロゴ画像のURL（オプション） */
  logo?: string
  /** 組織の説明（オプション） */
  description?: string
}

/**
 * Organization構造化データコンポーネント
 *
 * 組織（会社、団体）の情報を構造化データとして出力。
 * 検索結果でのナレッジパネル表示に使用される可能性がある。
 *
 * @param props - 組織情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <OrganizationJsonLd
 *   name="BON-LOG"
 *   url="https://bon-log.com"
 *   logo="https://bon-log.com/logo.png"
 *   description="盆栽愛好家のためのSNS"
 * />
 * ```
 */
export function OrganizationJsonLd({ name, url, logo, description }: OrganizationJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org', // Schema.orgの語彙を使用
    '@type': 'Organization',          // エンティティタイプ: 組織
    name,                              // 組織名
    url,                               // ウェブサイトURL
    ...(logo && { logo }),             // ロゴ（指定時のみ）
    ...(description && { description }), // 説明（指定時のみ）
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============================================================
// LocalBusiness（ローカルビジネス）
// ============================================================

/**
 * LocalBusinessJsonLdコンポーネントのプロパティ定義
 */
interface LocalBusinessJsonLdProps {
  /** 店舗・施設名 */
  name: string
  /** 住所 */
  address: string
  /** 店舗ページのURL */
  url: string
  /** 電話番号（オプション） */
  telephone?: string
  /** 営業時間（オプション） */
  openingHours?: string
  /** 総合評価（オプション） */
  aggregateRating?: {
    /** 平均評価値（1-5） */
    ratingValue: number
    /** レビュー件数 */
    reviewCount: number
  }
  /** 位置情報（オプション） */
  geo?: {
    /** 緯度 */
    latitude: number
    /** 経度 */
    longitude: number
  }
}

/**
 * LocalBusiness構造化データコンポーネント
 *
 * ローカルビジネス（盆栽園など）の情報を構造化データとして出力。
 * Googleマップやローカル検索結果での表示に影響する。
 *
 * @param props - ローカルビジネス情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <LocalBusinessJsonLd
 *   name="〇〇盆栽園"
 *   address="東京都〇〇区..."
 *   url="https://bon-log.com/shops/xxx"
 *   telephone="03-xxxx-xxxx"
 *   aggregateRating={{ ratingValue: 4.5, reviewCount: 10 }}
 *   geo={{ latitude: 35.6762, longitude: 139.6503 }}
 * />
 * ```
 */
export function LocalBusinessJsonLd({
  name,
  address,
  url,
  telephone,
  openingHours,
  aggregateRating,
  geo,
}: LocalBusinessJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',        // エンティティタイプ: ローカルビジネス
    '@id': url,                       // 一意識別子としてURLを使用
    name,
    // 住所を構造化（PostalAddress型）
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressCountry: 'JP',          // 日本固定
    },
    url,
    ...(telephone && { telephone }), // 電話番号（指定時のみ）
    ...(openingHours && { openingHours }), // 営業時間（指定時のみ）
    // 総合評価（指定時のみ）
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        reviewCount: aggregateRating.reviewCount,
        bestRating: 5,               // 最高評価: 5
        worstRating: 1,              // 最低評価: 1
      },
    }),
    // 位置情報（指定時のみ）
    ...(geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============================================================
// Event（イベント）
// ============================================================

/**
 * EventJsonLdコンポーネントのプロパティ定義
 */
interface EventJsonLdProps {
  /** イベント名 */
  name: string
  /** 開始日時（ISO 8601形式） */
  startDate: string
  /** 終了日時（ISO 8601形式、オプション） */
  endDate?: string
  /** 開催場所（オプション） */
  location?: {
    /** 場所名 */
    name?: string
    /** 住所 */
    address?: string
  }
  /** イベントの説明（オプション） */
  description?: string
  /** イベントページのURL */
  url: string
  /** 主催者名（オプション） */
  organizer?: string
  /** チケット情報（オプション） */
  offers?: {
    /** 価格 */
    price?: string
    /** 通貨（デフォルト: JPY） */
    priceCurrency?: string
  }
}

/**
 * Event構造化データコンポーネント
 *
 * イベント情報を構造化データとして出力。
 * Googleの検索結果やGoogleカレンダーでの表示に使用される。
 *
 * @param props - イベント情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <EventJsonLd
 *   name="盆栽展示会2026"
 *   startDate="2026-04-01T10:00:00+09:00"
 *   endDate="2026-04-03T17:00:00+09:00"
 *   location={{ name: "東京ドーム", address: "東京都文京区..." }}
 *   url="https://bon-log.com/events/xxx"
 *   organizer="日本盆栽協会"
 * />
 * ```
 */
export function EventJsonLd({
  name,
  startDate,
  endDate,
  location,
  description,
  url,
  organizer,
  offers,
}: EventJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',                // エンティティタイプ: イベント
    name,
    startDate,
    ...(endDate && { endDate }),     // 終了日時（指定時のみ）
    // 開催場所（指定時のみ）
    ...(location && {
      location: {
        '@type': 'Place',
        name: location.name || location.address,
        ...(location.address && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: location.address,
            addressCountry: 'JP',
          },
        }),
      },
    }),
    ...(description && { description }),
    url,
    // 主催者（指定時のみ）
    ...(organizer && {
      organizer: {
        '@type': 'Organization',
        name: organizer,
      },
    }),
    // チケット情報（指定時のみ）
    ...(offers && {
      offers: {
        '@type': 'Offer',
        price: offers.price || '0',           // 無料の場合は0
        priceCurrency: offers.priceCurrency || 'JPY',
        availability: 'https://schema.org/InStock', // 在庫あり
      },
    }),
    eventStatus: 'https://schema.org/EventScheduled', // イベント状態: 予定通り
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', // 参加形式: オフライン
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============================================================
// Article（記事）
// ============================================================

/**
 * ArticleJsonLdコンポーネントのプロパティ定義
 */
interface ArticleJsonLdProps {
  /** 記事タイトル */
  headline: string
  /** 公開日時（ISO 8601形式） */
  datePublished: string
  /** 更新日時（ISO 8601形式、オプション） */
  dateModified?: string
  /** 著者情報 */
  author: {
    /** 著者名 */
    name: string
    /** 著者プロフィールURL（オプション） */
    url?: string
  }
  /** 記事ページのURL */
  url: string
  /** アイキャッチ画像URL（オプション） */
  image?: string
  /** 記事の説明（オプション） */
  description?: string
}

/**
 * Article構造化データコンポーネント
 *
 * 記事（投稿）情報を構造化データとして出力。
 * Googleニュースや検索結果での表示に影響する。
 *
 * @param props - 記事情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <ArticleJsonLd
 *   headline="盆栽の育て方入門"
 *   datePublished="2026-01-01T12:00:00+09:00"
 *   author={{ name: "山田太郎", url: "https://bon-log.com/users/xxx" }}
 *   url="https://bon-log.com/posts/xxx"
 *   image="https://..."
 * />
 * ```
 */
export function ArticleJsonLd({
  headline,
  datePublished,
  dateModified,
  author,
  url,
  image,
  description,
}: ArticleJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',              // エンティティタイプ: 記事
    headline,
    datePublished,
    ...(dateModified && { dateModified }), // 更新日時（指定時のみ）
    // 著者情報
    author: {
      '@type': 'Person',
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    url,
    ...(image && { image }),         // 画像（指定時のみ）
    ...(description && { description }),
    // 発行者（サイト）情報
    publisher: {
      '@type': 'Organization',
      name: 'BON-LOG',
      url: process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============================================================
// Breadcrumb（パンくずリスト）
// ============================================================

/**
 * BreadcrumbJsonLdコンポーネントのプロパティ定義
 */
interface BreadcrumbJsonLdProps {
  /** パンくずアイテムの配列（階層順） */
  items: Array<{
    /** 項目名 */
    name: string
    /** 項目のURL */
    url: string
  }>
}

/**
 * Breadcrumb構造化データコンポーネント
 *
 * パンくずリストを構造化データとして出力。
 * 検索結果でのパンくず表示に使用される。
 *
 * @param props - パンくずリスト情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <BreadcrumbJsonLd
 *   items={[
 *     { name: "ホーム", url: "https://bon-log.com" },
 *     { name: "盆栽園", url: "https://bon-log.com/shops" },
 *     { name: "〇〇盆栽園", url: "https://bon-log.com/shops/xxx" },
 *   ]}
 * />
 * ```
 */
export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',       // エンティティタイプ: パンくずリスト
    // 各項目をListItem形式に変換（positionは1始まり）
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,           // 位置（1から開始）
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ============================================================
// WebSite（ウェブサイト）
// ============================================================

/**
 * WebSiteJsonLdコンポーネントのプロパティ定義
 */
interface WebSiteJsonLdProps {
  /** サイト名 */
  name: string
  /** サイトURL */
  url: string
  /** サイトの説明（オプション） */
  description?: string
  /** サイト内検索のURL（オプション） */
  searchUrl?: string
}

/**
 * WebSite構造化データコンポーネント
 *
 * ウェブサイト全体の情報を構造化データとして出力。
 * サイト内検索ボックスの表示に対応。
 *
 * @param props - ウェブサイト情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <WebSiteJsonLd
 *   name="BON-LOG"
 *   url="https://bon-log.com"
 *   description="盆栽愛好家のためのSNS"
 *   searchUrl="https://bon-log.com/search"
 * />
 * ```
 */
export function WebSiteJsonLd({ name, url, description, searchUrl }: WebSiteJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',              // エンティティタイプ: ウェブサイト
    name,
    url,
    ...(description && { description }),
    // サイト内検索（指定時のみ）- Sitelinkサーチボックス機能
    ...(searchUrl && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          // {search_term_string}はGoogleが検索クエリで置換するプレースホルダー
          urlTemplate: `${searchUrl}?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

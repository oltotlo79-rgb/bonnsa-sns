/**
 * キャッシュ戦略ユーティリティ
 *
 * このファイルは、頻繁にアクセスされるが変更頻度が低いデータをキャッシュする機能を提供します。
 * Next.js 15/16 の `unstable_cache` を使用して、サーバーサイドでのデータキャッシュを実現します。
 *
 * ## なぜキャッシュが必要か？
 *
 * ### 1. パフォーマンス向上
 * - データベースへのクエリは時間がかかる（ネットワーク遅延 + クエリ処理）
 * - 同じデータを何度もリクエストする場合、キャッシュから取得すれば高速
 *
 * ### 2. データベース負荷軽減
 * - 全ユーザーが同じデータ（ジャンル一覧など）をリクエストする場合、
 *   毎回DBにアクセスするとサーバー負荷が増大
 * - キャッシュにより、DBへのリクエスト数を大幅に削減
 *
 * ### 3. コスト削減
 * - クラウドDBは通常、リクエスト数や計算時間で課金される
 * - キャッシュによりDBリクエストを減らすことでコストを削減
 *
 * ## キャッシュ対象データの選定基準
 * - 変更頻度が低い（ジャンルマスタは管理者のみ変更）
 * - 多くのユーザーがアクセスする（全ユーザー共通のデータ）
 * - リアルタイム性が必須ではない（数分の遅延は許容される）
 *
 * ## キャッシュ時間の設定
 * - ジャンル一覧: 1時間（3600秒）- 変更頻度が非常に低い
 * - トレンドジャンル: 5分（300秒）- 適度に新鮮さを保つ
 * - 人気タグ: 5分（300秒）- 適度に新鮮さを保つ
 *
 * @module lib/cache
 */

// ============================================================
// インポート部分
// ============================================================

/**
 * unstable_cache: Next.jsのサーバーサイドキャッシュ機能
 *
 * ## なぜ"unstable"なのか？
 * - Next.js開発チームがAPIを将来変更する可能性があることを示す
 * - 現時点では安定して動作するが、将来のバージョンでAPI変更の可能性あり
 * - プロダクションでの使用は可能だが、アップグレード時は注意が必要
 *
 * ## 使用方法
 * ```typescript
 * const cachedFunction = unstable_cache(
 *   async () => { ... },     // データ取得ロジック
 *   ['cache-key'],           // キャッシュを識別するキー
 *   {
 *     revalidate: 3600,      // 再検証までの秒数
 *     tags: ['tag-name'],    // 手動無効化用のタグ
 *   }
 * )
 * ```
 *
 * revalidateTag: キャッシュを手動で無効化するための関数
 *
 * ## 使用シーン
 * - 管理者がジャンルを更新した時
 * - データが変更された時に即座にキャッシュを更新したい時
 *
 * ## 使用方法
 * ```typescript
 * // タグ名を指定してキャッシュを無効化
 * revalidateTag('genres', { expire: 0 })
 * ```
 *
 * ## Next.js 16での変更点
 * - 第2引数に `{ expire: 0 }` が必要になった
 * - expire: 0 は即時無効化を意味する
 */
import { unstable_cache, revalidateTag } from 'next/cache'

/**
 * prisma: データベースクライアント
 *
 * キャッシュされる関数内でデータベースにアクセスするために使用。
 * キャッシュが無効な場合（期限切れまたは初回アクセス）に
 * Prismaを使ってDBからデータを取得する。
 */
import { prisma } from '@/lib/db'

// ============================================================
// キャッシュタグ定義
// ============================================================

/**
 * キャッシュタグの定数定義
 *
 * ## なぜ定数オブジェクトとして定義するか？
 *
 * ### 1. タイプミス防止
 * ```typescript
 * // ❌ 文字列リテラルだとタイプミスに気づきにくい
 * revalidateTag('gneres')  // スペルミス！
 *
 * // ✅ 定数を使うとエディタの補完が効く
 * revalidateTag(CACHE_TAGS.GENRES)
 * ```
 *
 * ### 2. 一元管理
 * - タグ名を変更する場合、この1箇所を変更すればOK
 * - すべての使用箇所を手動で探す必要がない
 *
 * ### 3. 型安全性
 * - `as const` により、値が文字列リテラル型として推論される
 * - CACHE_TAGS.GENRES の型は 'genres' となる（stringではない）
 *
 * ## 各タグの用途
 * - GENRES: ジャンルマスタデータのキャッシュ
 * - TRENDING_GENRES: トレンドジャンル（投稿数ベース）のキャッシュ
 * - POPULAR_TAGS: 人気ハッシュタグのキャッシュ
 */
export const CACHE_TAGS = {
  GENRES: 'genres',
  TRENDING_GENRES: 'trending-genres',
  POPULAR_TAGS: 'popular-tags',
} as const

// ============================================================
// キャッシュ関数定義
// ============================================================

/**
 * ジャンル一覧を取得（キャッシュあり）
 *
 * ## キャッシュ設定
 * - revalidate: 3600秒（1時間）
 * - ジャンルは管理者のみが変更するため、長めのキャッシュ時間を設定
 *
 * ## 戻り値の構造
 * ```typescript
 * {
 *   genres: {
 *     '松柏類': [{ id: '1', name: '黒松', ... }, ...],
 *     '雑木類': [{ id: '2', name: 'もみじ', ... }, ...],
 *     // ...
 *   },
 *   allGenres: [ ... ]  // 全ジャンルのフラットな配列
 * }
 * ```
 *
 * ## カテゴリの表示順序
 * 1. 松柏類（しょうはくるい）- 松や檜など針葉樹
 * 2. 雑木類（ぞうきるい）- もみじや楓など広葉樹
 * 3. 草もの - 草花類
 * 4. 用品・道具 - 盆栽用の道具や資材
 * 5. 施設・イベント - 盆栽園やイベント情報
 * 6. その他
 *
 * ## unstable_cacheの引数
 * 1. async関数: 実際のデータ取得ロジック
 * 2. ['all-genres']: キャッシュキー（一意な識別子）
 * 3. オプション: revalidate（再検証間隔）とtags（無効化用タグ）
 */
export const getCachedGenres = unstable_cache(
  async () => {
    /**
     * データベースからジャンル一覧を取得
     *
     * orderBy: { sortOrder: 'asc' }
     * - sortOrderフィールドで昇順にソート
     * - 管理者が設定した表示順序を尊重
     */
    const genres = await prisma.genre.findMany({
      orderBy: [{ sortOrder: 'asc' }],
    })

    /**
     * カテゴリごとにジャンルをグループ化
     *
     * ## reduce()の動作
     * 配列を単一の値（この場合はオブジェクト）に集約する
     *
     * ## 処理フロー
     * 1. 空のオブジェクト {} から開始
     * 2. 各ジャンルを順番に処理
     * 3. カテゴリ名をキーとして、ジャンルを配列に追加
     *
     * ## 型定義
     * - GenreType: 単一ジャンルの型（Prismaが自動生成）
     * - Record<string, GenreType[]>: カテゴリ名→ジャンル配列のマップ
     */
    type GenreType = typeof genres[number]
    const groupedMap = genres.reduce((acc: Record<string, GenreType[]>, genre: GenreType) => {
      // カテゴリがまだ存在しない場合、空配列を初期化
      if (!acc[genre.category]) {
        acc[genre.category] = []
      }
      // 現在のジャンルを対応するカテゴリに追加
      acc[genre.category].push(genre)
      return acc
    }, {})

    /**
     * カテゴリの表示順序を定義
     *
     * ## なぜ明示的に順序を定義するか？
     * - オブジェクトのキーの順序は保証されない（ES2015以降は保持されるが）
     * - UIでの表示順序を明確に制御したい
     * - 新しいカテゴリが追加された場合の位置を管理しやすい
     */
    const categoryOrder = ['松柏類', '雑木類', '草もの', '用品・道具', '施設・イベント', 'その他']

    /**
     * 定義した順序でカテゴリを並べ替え
     *
     * ## 処理フロー
     * 1. 空のオブジェクトを作成
     * 2. categoryOrderの順番でループ
     * 3. groupedMapに存在するカテゴリのみを追加
     *
     * ## なぜこの方法か？
     * - 存在しないカテゴリは自動的にスキップされる
     * - 順序が確実に保持される
     */
    const grouped: Record<string, typeof genres> = {}
    for (const category of categoryOrder) {
      if (groupedMap[category]) {
        grouped[category] = groupedMap[category]
      }
    }

    return { genres: grouped, allGenres: genres }
  },
  ['all-genres'],  // キャッシュキー
  {
    revalidate: 3600, // 1時間（3600秒）
    tags: [CACHE_TAGS.GENRES],  // 手動無効化用のタグ
  }
)

/**
 * トレンドジャンルを取得（キャッシュあり）
 *
 * ## 機能概要
 * 直近48時間で投稿が多いジャンルをランキング形式で取得
 *
 * ## キャッシュ設定
 * - revalidate: 300秒（5分）
 * - トレンドは変動するため、短めのキャッシュ時間を設定
 *
 * ## パラメータ
 * @param limit - 取得するジャンル数（デフォルト: 5）
 *
 * ## 戻り値の構造
 * ```typescript
 * {
 *   genres: [
 *     { id: '1', name: '黒松', category: '松柏類', postCount: 25 },
 *     { id: '2', name: 'もみじ', category: '雑木類', postCount: 18 },
 *     // ...
 *   ]
 * }
 * ```
 */
export const getCachedTrendingGenres = unstable_cache(
  async (limit = 5) => {
    /**
     * 48時間前の日時を計算
     *
     * ## なぜ48時間か？
     * - 24時間だと変動が激しすぎる
     * - 1週間だと「トレンド」というより「定番」になる
     * - 48時間はトレンドを反映しつつ、安定したランキングを提供
     */
    const fortyEightHoursAgo = new Date()
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

    /**
     * ジャンルごとの投稿数を集計
     *
     * ## groupByとは？
     * SQLの GROUP BY に相当するPrisma機能
     * 特定のフィールドでレコードをグループ化し、集計を行う
     *
     * ## クエリの詳細
     * - by: ['genreId'] - genreIdでグループ化
     * - where: 48時間以内の投稿に絞り込み
     * - _count: 各グループのレコード数をカウント
     * - orderBy: カウント数の降順でソート
     * - take: 上位N件のみ取得
     */
    const trendingGenres = await prisma.postGenre.groupBy({
      by: ['genreId'],
      where: {
        post: {
          createdAt: { gte: fortyEightHoursAgo },  // gte = greater than or equal（以上）
        },
      },
      _count: {
        genreId: true,  // genreIdの出現回数をカウント
      },
      orderBy: {
        _count: {
          genreId: 'desc',  // 降順（多い順）
        },
      },
      take: limit,
    })

    /**
     * ジャンルIDの配列を作成
     *
     * map()で各アイテムからgenreIdだけを抽出
     */
    const genreIds = trendingGenres.map((g: typeof trendingGenres[number]) => g.genreId)

    /**
     * ジャンルの詳細情報を取得
     *
     * ## なぜ2回クエリを実行するか？
     * - groupByではジャンルのIDしか取得できない
     * - 名前やカテゴリなどの詳細情報は別途取得が必要
     *
     * ## in演算子
     * 指定した配列内のいずれかに一致するレコードを取得
     * SQL: WHERE id IN ('id1', 'id2', 'id3')
     */
    const genres = await prisma.genre.findMany({
      where: {
        id: { in: genreIds },
      },
    })

    /**
     * トレンドデータとジャンル詳細を結合
     *
     * ## 処理フロー
     * 1. trendingGenresの各アイテムをループ
     * 2. 対応するジャンル詳細を検索
     * 3. スプレッド構文で詳細情報とカウントを結合
     * 4. ジャンルが見つからないアイテムを除外
     */
    return {
      genres: trendingGenres.map((g: typeof trendingGenres[number]) => {
        // genreIdに対応するジャンル詳細を検索
        const genre = genres.find((gen: typeof genres[number]) => gen.id === g.genreId)
        return {
          ...genre,  // ジャンルの全プロパティをコピー
          postCount: g._count.genreId,  // 投稿数を追加
        }
      }).filter((g: { id?: string }) => g.id),  // idが存在するもののみ（見つからなかったものを除外）
    }
  },
  ['trending-genres'],  // キャッシュキー
  {
    revalidate: 300, // 5分（300秒）
    tags: [CACHE_TAGS.TRENDING_GENRES],
  }
)

/**
 * 人気タグを取得（キャッシュあり）
 *
 * ## 機能概要
 * 直近1週間で最も使用されたハッシュタグをランキング形式で取得
 *
 * ## キャッシュ設定
 * - revalidate: 300秒（5分）
 * - トレンドは変動するため、短めのキャッシュ時間を設定
 *
 * ## パラメータ
 * @param limit - 取得するタグ数（デフォルト: 10）
 *
 * ## 戻り値の構造
 * ```typescript
 * {
 *   tags: [
 *     { tag: '盆栽', count: 150 },
 *     { tag: '黒松', count: 89 },
 *     // ...
 *   ]
 * }
 * ```
 *
 * ## ハッシュタグの検出
 * 正規表現を使用して投稿本文からハッシュタグを抽出
 * 対応文字: 半角英数字、ひらがな、カタカナ、漢字
 */
export const getCachedPopularTags = unstable_cache(
  async (limit = 10) => {
    /**
     * 1週間前の日時を計算
     *
     * ## なぜ1週間か？
     * - トレンドジャンル（48時間）より長い期間で安定したタグを表示
     * - あまり長すぎると古いタグが残り続ける
     */
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    /**
     * ハッシュタグを含む投稿を取得
     *
     * ## クエリの詳細
     * - isHidden: false - 非表示の投稿を除外
     * - createdAt: { gte: oneWeekAgo } - 1週間以内の投稿
     * - content: { contains: '#' } - #を含む投稿のみ
     * - select: { content: true } - 本文のみ取得（パフォーマンス最適化）
     */
    const posts = await prisma.post.findMany({
      where: {
        isHidden: false,
        createdAt: { gte: oneWeekAgo },
        content: {
          contains: '#',
        },
      },
      select: {
        content: true,
      },
    })

    /**
     * ハッシュタグを抽出してカウント
     *
     * ## tagCounts オブジェクト
     * キー: タグ名（#を除く、小文字化）
     * 値: 出現回数
     *
     * ## 正規表現の解説
     * /#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g
     *
     * - #: リテラルの#記号
     * - \w: 半角英数字とアンダースコア [a-zA-Z0-9_]
     * - \u3040-\u309f: ひらがな
     * - \u30a0-\u30ff: カタカナ
     * - \u4e00-\u9faf: CJK統合漢字（中国語、日本語、韓国語の漢字）
     * - +: 1文字以上の繰り返し
     * - g: グローバルフラグ（すべてのマッチを検索）
     */
    const tagCounts: Record<string, number> = {}
    const hashtagRegex = /#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g

    for (const post of posts) {
      // 本文がnullの場合はスキップ
      if (!post.content) continue

      // 正規表現でハッシュタグを抽出（マッチしない場合は空配列）
      const tags = post.content.match(hashtagRegex) || []

      for (const tag of tags) {
        // #を除去し、小文字化（大文字小文字を区別しない）
        const normalizedTag = tag.slice(1).toLowerCase()
        // カウントをインクリメント（初回は0から開始）
        tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1
      }
    }

    /**
     * カウント順にソートして上位N件を返す
     *
     * ## 処理フロー
     * 1. Object.entries(): オブジェクトを [key, value] ペアの配列に変換
     * 2. sort(): カウント数の降順でソート（b - a で降順）
     * 3. slice(0, limit): 上位N件を取得
     * 4. map(): { tag, count } オブジェクトの配列に変換
     */
    const sortedTags = Object.entries(tagCounts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, limit)
      .map(([tag, count]: [string, number]) => ({ tag, count }))

    return { tags: sortedTags }
  },
  ['popular-tags'],  // キャッシュキー
  {
    revalidate: 300, // 5分（300秒）
    tags: [CACHE_TAGS.POPULAR_TAGS],
  }
)

// ============================================================
// キャッシュ無効化関数
// ============================================================

/**
 * ジャンルキャッシュを無効化
 *
 * ## 使用シーン
 * - 管理者がジャンルを追加・編集・削除した時
 * - ジャンルのsortOrderを変更した時
 *
 * ## Next.js 16での変更点
 * revalidateTagの第2引数に `{ expire: 0 }` が必要
 * - expire: 0 は即時無効化を意味する
 * - 将来的には段階的な無効化オプションも追加される可能性がある
 *
 * ## 使用例
 * ```typescript
 * // 管理画面でジャンルを更新した後
 * await prisma.genre.update({ ... })
 * revalidateGenresCache()
 * ```
 */
export function revalidateGenresCache() {
  revalidateTag(CACHE_TAGS.GENRES, { expire: 0 })
}

/**
 * トレンドジャンルキャッシュを無効化
 *
 * ## 使用シーン
 * - 手動でトレンドを更新したい場合
 * - 通常は5分ごとに自動更新されるため、あまり使用しない
 *
 * ## 使用例
 * ```typescript
 * // 手動でトレンドを更新
 * revalidateTrendingGenresCache()
 * ```
 */
export function revalidateTrendingGenresCache() {
  revalidateTag(CACHE_TAGS.TRENDING_GENRES, { expire: 0 })
}

/**
 * 人気タグキャッシュを無効化
 *
 * ## 使用シーン
 * - 手動で人気タグを更新したい場合
 * - スパムタグを削除した後など
 *
 * ## 使用例
 * ```typescript
 * // スパム投稿を削除した後
 * await deleteSpamPosts()
 * revalidatePopularTagsCache()
 * ```
 */
export function revalidatePopularTagsCache() {
  revalidateTag(CACHE_TAGS.POPULAR_TAGS, { expire: 0 })
}

/**
 * ブロック/ミュートフィルタリングヘルパー
 *
 * このファイルは、ブロックやミュートしたユーザーをフィルタリングするための
 * 共通ユーティリティ関数を提供します。タイムライン、検索、通知など
 * 様々な機能で使用されます。
 *
 * ## なぜこのファイルが必要か？
 *
 * ### 1. コードの重複を防ぐ
 * - ブロック/ミュートのフィルタリングロジックは複数の場所で使用される
 * - 同じコードを何度も書くとバグの原因になる
 * - 一箇所にまとめることで保守性が向上
 *
 * ### 2. 柔軟なフィルタリング
 * - 機能によって必要なフィルターが異なる
 *   - タイムライン: ブロック双方向 + ミュート
 *   - 検索: ブロック双方向（ミュートは含めない場合も）
 *   - 通知: ブロック双方向のみ
 * - オプションで柔軟に組み合わせ可能
 *
 * ### 3. パフォーマンス最適化
 * - Promise.allで並列クエリを実行
 * - Setを使った重複除去で効率的な処理
 *
 * ## ブロックとミュートの違い
 *
 * ### ブロック
 * - 双方向の関係（お互いのコンテンツが見えなくなる）
 * - ブロックした側：相手の投稿が見えない
 * - ブロックされた側：相手の投稿が見えない
 *
 * ### ミュート
 * - 一方向の関係（ミュートした側だけに影響）
 * - ミュートした側：相手の投稿がタイムラインに表示されない
 * - ミュートされた側：何も影響なし（気づかない）
 *
 * @module lib/actions/filter-helper
 */

// ============================================================
// ディレクティブとインポート
// ============================================================

/**
 * 'use server' ディレクティブ
 *
 * ## Server Actionsとは？
 * Next.js 13+で導入された機能で、サーバーサイドで実行される関数を定義できる
 *
 * ## なぜ必要か？
 * - データベースアクセスはサーバー側でのみ実行可能
 * - このファイルの関数は他のServer Actionsから呼び出される
 * - クライアントから直接呼び出されることはないが、
 *   Server Actionsモジュール内で使用するため必要
 */
'use server'

/**
 * prisma: データベースクライアント
 *
 * ブロック/ミュートのレコードを取得するために使用
 */
import { prisma } from '@/lib/db'

// ============================================================
// 型定義
// ============================================================

/**
 * フィルターオプションの型定義
 *
 * ## 各オプションの説明
 *
 * ### blocked (自分がブロックしたユーザー)
 * - true: 自分がブロックしたユーザーを除外リストに追加
 * - false/未指定: 含めない
 * - 使用例: 検索結果からブロックした人を除外
 *
 * ### blockedBy (自分をブロックしたユーザー)
 * - true: 自分をブロックしたユーザーを除外リストに追加
 * - false/未指定: 含めない
 * - 使用例: 相手にブロックされていたら、相手のコンテンツも非表示に
 *
 * ### muted (自分がミュートしたユーザー)
 * - true: 自分がミュートしたユーザーを除外リストに追加
 * - false/未指定: 含めない
 * - 使用例: タイムラインからミュートした人の投稿を除外
 *
 * ## 使用例
 * ```typescript
 * // タイムライン用（ブロック双方向 + ミュート）
 * getExcludedUserIds(userId, { blocked: true, blockedBy: true, muted: true })
 *
 * // 検索用（ブロック双方向のみ）
 * getExcludedUserIds(userId, { blocked: true, blockedBy: true })
 *
 * // 通知用（ブロック双方向のみ）
 * getExcludedUserIds(userId, { blocked: true, blockedBy: true })
 * ```
 */
export type FilterOptions = {
  blocked?: boolean    // 自分がブロックしたユーザー
  blockedBy?: boolean  // 自分をブロックしたユーザー
  muted?: boolean      // 自分がミュートしたユーザー
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 除外するユーザーIDの配列を取得
 *
 * ## 機能概要
 * 指定されたオプションに基づいて、フィルタリング対象となる
 * ユーザーIDの配列を返します。
 *
 * ## パラメータ
 * @param userId - 現在のユーザーID（フィルタリングの基準）
 * @param options - フィルターオプション（どの種類のユーザーを除外するか）
 *
 * ## 戻り値
 * @returns Promise<string[]> - 除外すべきユーザーIDの配列
 *
 * ## 処理フロー
 * 1. オプションの解析（デフォルト値の適用）
 * 2. 必要なクエリの構築
 * 3. Promise.allで並列実行
 * 4. 結果をSetにマージ（重複除去）
 * 5. 自分自身を除外リストから削除
 * 6. 配列に変換して返却
 *
 * ## 使用例
 * ```typescript
 * // タイムラインでの使用
 * const excludeIds = await getExcludedUserIds(userId, {
 *   blocked: true,
 *   blockedBy: true,
 *   muted: true
 * })
 *
 * // 投稿取得時に除外
 * const posts = await prisma.post.findMany({
 *   where: {
 *     userId: { notIn: excludeIds }
 *   }
 * })
 * ```
 */
export async function getExcludedUserIds(
  userId: string,
  options: FilterOptions = {}
): Promise<string[]> {
  /**
   * オプションの分割代入とデフォルト値
   *
   * ## 分割代入（Destructuring）とは？
   * オブジェクトのプロパティを個別の変数に展開する構文
   *
   * ## デフォルト値の指定
   * `blocked = false` は、optionsにblockedが含まれない場合はfalseを使用
   */
  const { blocked = false, blockedBy = false, muted = false } = options

  /**
   * 早期リターン（Early Return）
   *
   * すべてのオプションがfalseの場合、DBクエリを実行する必要がないため
   * 即座に空配列を返す。これによりパフォーマンスが向上。
   */
  if (!blocked && !blockedBy && !muted) {
    return []
  }

  /**
   * クエリ配列の初期化
   *
   * ## Promise<unknown[]>[] とは？
   * - Promiseの配列
   * - 各Promiseは配列を解決する（findManyの結果）
   * - unknown型を使用するのは、ブロックとミュートで異なる型のレコードが返るため
   */
  const queries: Promise<unknown[]>[] = []

  /**
   * ブロック関連のクエリ構築
   *
   * ## OR条件の構築
   * - blocked: true の場合、blockerId が userId のレコードを検索
   *   （自分がブロックした相手を取得）
   * - blockedBy: true の場合、blockedId が userId のレコードを検索
   *   （自分をブロックした相手を取得）
   *
   * ## 1つのクエリで両方を取得する理由
   * - 別々にクエリを実行するより効率的
   * - OR条件で1回のDBアクセスで済む
   */
  if (blocked || blockedBy) {
    // OR条件用のオブジェクトを構築
    const blockWhere: { OR: object[] } = { OR: [] }

    if (blocked) {
      // 自分がブロックしたユーザーを検索
      blockWhere.OR.push({ blockerId: userId })
    }
    if (blockedBy) {
      // 自分をブロックしたユーザーを検索
      blockWhere.OR.push({ blockedId: userId })
    }

    // クエリを配列に追加
    queries.push(
      prisma.block.findMany({
        where: blockWhere,
        select: {
          blockerId: true,   // ブロックした人のID
          blockedId: true,   // ブロックされた人のID
        },
      })
    )
  }

  /**
   * ミュートのクエリ構築
   *
   * ## ミュートは一方向のみ
   * - ブロックと異なり、双方向の関係はない
   * - 自分がミュートした相手のみを取得
   */
  if (muted) {
    queries.push(
      prisma.mute.findMany({
        where: { muterId: userId },  // 自分がミュートした相手
        select: { mutedId: true },   // ミュートされた人のID
      })
    )
  }

  /**
   * 並列クエリ実行
   *
   * ## Promise.all とは？
   * - 複数のPromiseを同時に実行
   * - すべてが完了するまで待機
   * - 順次実行より高速
   *
   * ## 例
   * クエリ1: 100ms、クエリ2: 80ms の場合
   * - 順次実行: 180ms
   * - 並列実行: 100ms（最も遅いクエリの時間）
   */
  const results = await Promise.all(queries)

  /**
   * 結果をSetにマージ
   *
   * ## Setを使う理由
   * - 重複を自動的に除去
   * - add/deleteが高速（O(1)）
   * - 同じユーザーがブロックとミュートの両方に存在しても1回だけ含まれる
   */
  const excludedIds = new Set<string>()

  /**
   * 結果の処理
   *
   * ## 二重ループの構造
   * - 外側: 各クエリの結果を順番に処理
   * - 内側: 各結果配列のアイテムを処理
   *
   * ## 型アサーション
   * `as Array<{ blockerId?: string; blockedId?: string; mutedId?: string }>`
   * - unknown型を具体的な型に変換
   * - ブロックとミュートの両方の結果を同じ形式で処理可能に
   */
  for (const items of results) {
    for (const item of items as Array<{ blockerId?: string; blockedId?: string; mutedId?: string }>) {
      /**
       * ブロック結果の処理
       *
       * 'blockedId' in item: itemにblockedIdプロパティが存在するかチェック
       * item.blockedId: 値がnull/undefinedでないかチェック
       * blocked: このオプションが有効かチェック
       */
      if ('blockedId' in item && item.blockedId && blocked) {
        // 自分がブロックした相手のIDを追加
        excludedIds.add(item.blockedId)
      }
      if ('blockerId' in item && item.blockerId && blockedBy) {
        // 自分をブロックした相手のIDを追加
        excludedIds.add(item.blockerId)
      }

      /**
       * ミュート結果の処理
       *
       * ミュートは常にmutedIdを追加（オプションチェックは不要、
       * ミュートクエリを実行している時点でmuted=trueは確定）
       */
      if ('mutedId' in item && item.mutedId) {
        excludedIds.add(item.mutedId)
      }
    }
  }

  /**
   * 自分自身を除外リストから削除
   *
   * ## なぜ必要か？
   * - blockedByの場合、自分のIDがblockedIdとして含まれる可能性がある
   * - 自分自身をフィルタリングしてしまうと、自分の投稿が見えなくなる
   */
  excludedIds.delete(userId)

  /**
   * SetをArrayに変換して返却
   *
   * Array.from(): イテラブル（Set含む）から配列を作成
   * Prismaのin/notIn句は配列を期待するため、変換が必要
   */
  return Array.from(excludedIds)
}

// ============================================================
// シンプル版ヘルパー関数
// ============================================================

/**
 * ブロックしたユーザーIDのみを取得（シンプルなケース用）
 *
 * ## 用途
 * 複雑なオプションが不要で、単純に「自分がブロックした相手」の
 * リストが欲しい場合に使用
 *
 * ## getExcludedUserIdsとの違い
 * - よりシンプルで直接的
 * - 1種類のフィルターのみ
 * - 内部でオプション解析が不要なため、わずかに高速
 *
 * ## パラメータ
 * @param userId - 現在のユーザーID
 *
 * ## 戻り値
 * @returns Promise<string[]> - ブロックしたユーザーIDの配列
 *
 * ## 使用例
 * ```typescript
 * const blockedIds = await getBlockedUserIds(userId)
 * // ['user-1', 'user-2', ...]
 * ```
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },  // 自分がブロックした相手
    select: { blockedId: true },   // ブロックされた人のIDのみ取得
  })

  /**
   * map()でIDのみの配列に変換
   *
   * blocks: [{ blockedId: 'user-1' }, { blockedId: 'user-2' }]
   * 結果: ['user-1', 'user-2']
   */
  return blocks.map((b: { blockedId: string }) => b.blockedId)
}

/**
 * ミュートしたユーザーIDのみを取得（シンプルなケース用）
 *
 * ## 用途
 * 単純に「自分がミュートした相手」のリストが欲しい場合に使用
 *
 * ## パラメータ
 * @param userId - 現在のユーザーID
 *
 * ## 戻り値
 * @returns Promise<string[]> - ミュートしたユーザーIDの配列
 *
 * ## 使用例
 * ```typescript
 * const mutedIds = await getMutedUserIds(userId)
 * // 設定画面でミュートリストを表示する場合など
 * ```
 */
export async function getMutedUserIds(userId: string): Promise<string[]> {
  const mutes = await prisma.mute.findMany({
    where: { muterId: userId },  // 自分がミュートした相手
    select: { mutedId: true },   // ミュートされた人のIDのみ取得
  })

  /**
   * map()でIDのみの配列に変換
   */
  return mutes.map((m: { mutedId: string }) => m.mutedId)
}

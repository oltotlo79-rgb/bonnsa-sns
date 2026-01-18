/**
 * 都道府県・地方ブロック定数定義
 *
 * このファイルは、日本の都道府県と地方ブロックに関する
 * マスターデータと操作関数を提供します。
 *
 * ## 用途
 * - イベント検索の地域フィルター
 * - 盆栽園の所在地表示
 * - ユーザーの居住地域選択
 *
 * ## データ構造
 * - PREFECTURES: 47都道府県の配列（北から南の順）
 * - REGIONS: 8つの地方ブロックと所属都道府県のマッピング
 *
 * ## TypeScript の型安全性
 * `as const` を使用することで、配列の値がリテラル型として扱われ、
 * 型安全なコードが書けます。
 *
 * @module lib/constants/prefectures
 */

// ============================================================
// 都道府県マスターデータ
// ============================================================

/**
 * 47都道府県の配列
 *
 * ## 配列の順序
 * 北から南へ、以下の順序で並んでいます:
 * 1. 北海道
 * 2. 東北（6県）
 * 3. 関東（7都県）
 * 4. 中部（9県）
 * 5. 近畿（7府県）
 * 6. 中国（5県）
 * 7. 四国（4県）
 * 8. 九州・沖縄（8県）
 *
 * ## as const とは？
 * TypeScript の const assertion（定数アサーション）。
 * 配列を readonly（読み取り専用）にし、
 * 要素の型をリテラル型として推論させます。
 *
 * ```typescript
 * // as const なし
 * const arr = ['北海道']  // 型: string[]
 *
 * // as const あり
 * const arr = ['北海道'] as const  // 型: readonly ['北海道']
 * ```
 *
 * ## 使用例
 * ```typescript
 * // セレクトボックスのオプション生成
 * PREFECTURES.map(pref => (
 *   <option key={pref} value={pref}>{pref}</option>
 * ))
 * ```
 */
export const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
  '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const

/**
 * 都道府県の型
 *
 * ## typeof PREFECTURES[number] の解説
 *
 * 1. typeof PREFECTURES
 *    → readonly ['北海道', '青森県', ...] という配列型
 *
 * 2. [number]
 *    → 配列の要素にアクセスするインデックス型
 *    → '北海道' | '青森県' | ... という Union 型になる
 *
 * ## 使用例
 * ```typescript
 * const pref: Prefecture = '東京都'  // OK
 * const pref: Prefecture = '不明県'  // エラー！
 * ```
 *
 * ## なぜこの型が必要か？
 * - 存在しない都道府県名の入力を防止
 * - IDEでの自動補完が効く
 * - リファクタリング時の安全性
 */
export type Prefecture = typeof PREFECTURES[number]

// ============================================================
// 地方ブロック定義
// ============================================================

/**
 * 地方ブロックと所属都道府県のマッピング
 *
 * ## 8つの地方ブロック
 * 1. 北海道（1道）
 * 2. 東北（6県）
 * 3. 関東（7都県）
 * 4. 中部（9県）
 * 5. 近畿（7府県）
 * 6. 中国（5県）
 * 7. 四国（4県）
 * 8. 九州・沖縄（8県）
 *
 * ## オブジェクト構造
 * ```typescript
 * {
 *   '地方名': ['都道府県1', '都道府県2', ...],
 *   ...
 * }
 * ```
 *
 * ## 使用例
 * ```typescript
 * // 関東地方の都道府県を取得
 * const kanto = REGIONS['関東']
 * // ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県']
 * ```
 */
export const REGIONS = {
  '北海道': ['北海道'],
  '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
  '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
} as const

/**
 * 地方ブロック名の型
 *
 * ## keyof typeof REGIONS の解説
 *
 * 1. typeof REGIONS
 *    → オブジェクトの型を取得
 *
 * 2. keyof
 *    → オブジェクトのキー（プロパティ名）をUnion型として取得
 *    → '北海道' | '東北' | '関東' | ... という型
 *
 * ## 使用例
 * ```typescript
 * const region: Region = '関東'  // OK
 * const region: Region = '北陸'  // エラー！（存在しない地方名）
 * ```
 */
export type Region = keyof typeof REGIONS

/**
 * 地方ブロック名の配列
 *
 * ## Object.keys() と型キャスト
 * Object.keys() は string[] を返すため、
 * Region[] にキャストして型安全性を確保。
 *
 * ## 使用例
 * ```typescript
 * // 地方選択のドロップダウン
 * REGION_LIST.map(region => (
 *   <option key={region} value={region}>{region}</option>
 * ))
 * ```
 */
export const REGION_LIST = Object.keys(REGIONS) as Region[]

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 地方ブロックから都道府県リストを取得
 *
 * ## 機能概要
 * 指定した地方ブロックに属する都道府県の配列を返します。
 *
 * ## パラメータ
 * @param region - 地方ブロック名（例: '関東', '東北'）
 *
 * ## 戻り値
 * @returns string[] - 都道府県名の配列
 *
 * ## スプレッド構文 [...prefectures]
 * 元の readonly 配列をコピーして通常の配列として返す。
 * これにより、呼び出し側で配列を変更しても元データに影響しない。
 *
 * ## 使用例
 * ```typescript
 * const kantoPrefectures = getPrefecturesByRegion('関東')
 * // ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県']
 *
 * // イベント検索で地方絞り込み
 * const events = await prisma.event.findMany({
 *   where: {
 *     prefecture: { in: getPrefecturesByRegion(selectedRegion) }
 *   }
 * })
 * ```
 */
export function getPrefecturesByRegion(region: Region): string[] {
  /**
   * 指定された地方の都道府県配列を取得
   */
  const prefectures = REGIONS[region]

  /**
   * 配列が存在すればコピーを返す、なければ空配列
   *
   * [...prefectures]: スプレッド構文で新しい配列を作成
   * readonly を解除して編集可能な配列として返す
   */
  return prefectures ? [...prefectures] : []
}

/**
 * 都道府県から地方ブロックを取得
 *
 * ## 機能概要
 * 指定した都道府県が属する地方ブロック名を返します。
 *
 * ## パラメータ
 * @param prefecture - 都道府県名（例: '東京都', '大阪府'）
 *
 * ## 戻り値
 * @returns Region | null
 *   - 見つかった場合: 地方ブロック名
 *   - 見つからない場合: null
 *
 * ## アルゴリズム
 * 1. REGIONS オブジェクトの全エントリーを順に確認
 * 2. 各地方の都道府県配列に指定した都道府県が含まれるか確認
 * 3. 見つかったら地方名を返す
 * 4. 全て確認しても見つからなければ null を返す
 *
 * ## 使用例
 * ```typescript
 * getRegionByPrefecture('東京都')    // '関東'
 * getRegionByPrefecture('大阪府')    // '近畿'
 * getRegionByPrefecture('沖縄県')    // '九州・沖縄'
 * getRegionByPrefecture('不明県')    // null
 * ```
 *
 * ## パフォーマンス
 * 最悪の場合、47都道府県全てを確認するが、
 * データ量が少ないため問題にならない（O(n)）。
 */
export function getRegionByPrefecture(prefecture: string): Region | null {
  /**
   * Object.entries() でキーと値のペアを取得してループ
   *
   * entries の形式: [['北海道', ['北海道']], ['東北', [...]], ...]
   */
  for (const [region, prefectures] of Object.entries(REGIONS)) {
    /**
     * 型アサーション: as readonly string[]
     *
     * TypeScript の Object.entries() は値の型を推論できないため、
     * 明示的に readonly string[] であることを示す。
     *
     * includes(): 配列に指定の要素が含まれるか確認
     */
    if ((prefectures as readonly string[]).includes(prefecture)) {
      /**
       * 見つかったら地方名を返す
       * as Region: 型アサーションでRegion型として返す
       */
      return region as Region
    }
  }

  /**
   * 見つからなかった場合は null を返す
   */
  return null
}

/**
 * 日本の地方・都道府県データ
 *
 * 盆栽園の絞り込み検索で使用
 */

/**
 * 地方の型定義
 */
export interface Region {
  id: string
  name: string
  prefectures: string[]
}

/**
 * 都道府県一覧（北から南の順）
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
 * 地方データ（北から南の順）
 */
export const REGIONS: Region[] = [
  {
    id: 'hokkaido-tohoku',
    name: '北海道・東北',
    prefectures: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  },
  {
    id: 'kanto',
    name: '関東',
    prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  },
  {
    id: 'chubu',
    name: '中部',
    prefectures: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  },
  {
    id: 'kinki',
    name: '近畿',
    prefectures: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  },
  {
    id: 'chugoku',
    name: '中国',
    prefectures: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  },
  {
    id: 'shikoku',
    name: '四国',
    prefectures: ['徳島県', '香川県', '愛媛県', '高知県'],
  },
  {
    id: 'kyushu-okinawa',
    name: '九州・沖縄',
    prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
  },
]

/**
 * 住所から都道府県を抽出
 * @param address - 住所文字列
 * @returns 都道府県名、見つからない場合はnull
 */
export function extractPrefecture(address: string): string | null {
  for (const pref of PREFECTURES) {
    if (address.startsWith(pref)) {
      return pref
    }
  }
  return null
}

/**
 * 都道府県から地方を取得
 * @param prefecture - 都道府県名
 * @returns 地方オブジェクト、見つからない場合はnull
 */
export function getRegionByPrefecture(prefecture: string): Region | null {
  return REGIONS.find(region => region.prefectures.includes(prefecture)) || null
}

/**
 * 地方IDから地方を取得
 * @param regionId - 地方ID
 * @returns 地方オブジェクト、見つからない場合はnull
 */
export function getRegionById(regionId: string): Region | null {
  return REGIONS.find(region => region.id === regionId) || null
}

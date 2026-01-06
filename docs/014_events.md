# 014: イベント機能

## 概要
盆栽関連イベントの登録・検索・カレンダー表示機能を実装する。
地域フィルタリングと自動終了処理を含む。

## 優先度
**中** - Phase 5

## 依存チケット
- 001: プロジェクトセットアップ
- 003: 認証システム

---

## Todo

### パッケージインストール
- [ ] カレンダーライブラリ（react-big-calendar or FullCalendar）
- [ ] date-fns（日付処理）

### イベントページ
- [ ] `app/(main)/events/page.tsx` - イベント一覧/カレンダーページ
- [ ] `app/(main)/events/[id]/page.tsx` - イベント詳細ページ
- [ ] `app/(main)/events/new/page.tsx` - イベント登録ページ
- [ ] `app/(main)/events/[id]/edit/page.tsx` - イベント編集ページ

### カレンダーコンポーネント
- [ ] `components/event/EventCalendar.tsx` - カレンダー表示
  - [ ] 月表示
  - [ ] 週表示
  - [ ] 日付クリックでイベント表示
- [ ] `components/event/CalendarDay.tsx` - カレンダー日付セル
- [ ] `components/event/CalendarEvent.tsx` - カレンダー上のイベント表示

### イベントコンポーネント
- [ ] `components/event/EventCard.tsx` - イベントカード
- [ ] `components/event/EventList.tsx` - イベントリスト
- [ ] `components/event/EventDetail.tsx` - イベント詳細
- [ ] `components/event/EventForm.tsx` - イベント登録/編集フォーム
- [ ] `components/event/RegionFilter.tsx` - 地域フィルター

### イベント登録項目
**必須項目:**
- [ ] タイトル入力
- [ ] 開始日時選択
- [ ] 終了日時選択（任意）
- [ ] 都道府県選択
- [ ] 市区町村入力

**任意項目:**
- [ ] 会場名
- [ ] 主催者情報
- [ ] 入場料
- [ ] 即売の有無（チェックボックス）
- [ ] 詳細説明（テキストエリア）
- [ ] 外部リンク（公式サイト、申し込みページ等）

### Server Actions
- [ ] `lib/actions/event.ts`
  - [ ] `createEvent` - イベント登録
  - [ ] `updateEvent` - イベント更新
  - [ ] `deleteEvent` - イベント削除
  - [ ] `getEvent` - イベント詳細取得
  - [ ] `getEvents` - イベント一覧取得
  - [ ] `getUpcomingEvents` - 今後のイベント取得
  - [ ] `getEventsByMonth` - 月別イベント取得
  - [ ] `getEventsByRegion` - 地域別イベント取得

### 地域フィルター
- [ ] 都道府県選択
- [ ] 地方ブロック選択
  - [ ] 北海道
  - [ ] 東北（青森、岩手、宮城、秋田、山形、福島）
  - [ ] 関東（茨城、栃木、群馬、埼玉、千葉、東京、神奈川）
  - [ ] 中部（新潟、富山、石川、福井、山梨、長野、岐阜、静岡、愛知）
  - [ ] 近畿（三重、滋賀、京都、大阪、兵庫、奈良、和歌山）
  - [ ] 中国（鳥取、島根、岡山、広島、山口）
  - [ ] 四国（徳島、香川、愛媛、高知）
  - [ ] 九州・沖縄（福岡、佐賀、長崎、熊本、大分、宮崎、鹿児島、沖縄）
- [ ] 複数地域選択対応
- [ ] フィルター状態のURL反映

### 終了イベント処理
- [ ] 終了日が過去のイベントを自動非表示
- [ ] 終了イベント表示切り替えオプション
- [ ] Supabaseスケジュール関数での自動アーカイブ（将来）

### 表示切り替え
- [ ] カレンダー表示
- [ ] リスト表示
- [ ] 切り替えボタン

### 権限管理
- [ ] 自分が登録したイベントのみ編集/削除可能
- [ ] 通報機能連携

### 日付・時刻処理
- [ ] 日本時間（JST）での表示
- [ ] 日付フォーマット（YYYY年MM月DD日）
- [ ] 曜日表示

### UI/UX
- [ ] カレンダーのスムーズな操作
- [ ] 月送りアニメーション
- [ ] 今日の日付ハイライト
- [ ] イベントのある日付のマーク
- [ ] レスポンシブ対応

### 都道府県マスターデータ
- [ ] 47都道府県のマスターデータ作成
- [ ] 地方ブロックとの紐付け

---

## 完了条件
- [ ] カレンダーが正常に表示される
- [ ] イベント登録が正常に動作する
- [ ] 地域フィルターが正常に動作する
- [ ] 終了イベントが非表示になる
- [ ] イベント詳細が正常に表示される

## 参考コード
```typescript
// components/event/EventCalendar.tsx
'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { ja } from 'date-fns/locale'

interface Event {
  id: string
  title: string
  start_date: string
  end_date?: string
  prefecture: string
}

export function EventCalendar({ events }: { events: Event[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_date)
      return isSameDay(eventDate, day)
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          前月
        </button>
        <h2>{format(currentMonth, 'yyyy年MM月', { locale: ja })}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          次月
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
          <div key={day} className="text-center font-bold p-2">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day)
          return (
            <div
              key={day.toISOString()}
              className={`p-2 border min-h-[80px] ${
                !isSameMonth(day, currentMonth) ? 'bg-gray-100' : ''
              }`}
            >
              <div className="font-bold">{format(day, 'd')}</div>
              {dayEvents.map((event) => (
                <a
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block text-xs bg-green-100 p-1 rounded mt-1 truncate"
                >
                  {event.title}
                </a>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

```typescript
// lib/actions/event.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getUpcomingEvents(region?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('events')
    .select('*')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .order('start_date', { ascending: true })

  if (region) {
    // 地方ブロックから都道府県リストを取得
    const prefectures = getPrefecturesByRegion(region)
    query = query.in('prefecture', prefectures)
  }

  const { data: events, error } = await query

  if (error) {
    return { error: 'イベントの取得に失敗しました' }
  }

  return { events }
}

function getPrefecturesByRegion(region: string): string[] {
  const regionMap: Record<string, string[]> = {
    '北海道': ['北海道'],
    '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
    '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
    '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
    '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
    '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
    '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
    '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
  }
  return regionMap[region] || []
}
```

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
- [x] カレンダーライブラリ（react-big-calendar or FullCalendar）
- [x] date-fns（日付処理）

### イベントページ
- [x] `app/(main)/events/page.tsx` - イベント一覧/カレンダーページ
- [x] `app/(main)/events/[id]/page.tsx` - イベント詳細ページ
- [x] `app/(main)/events/new/page.tsx` - イベント登録ページ
- [x] `app/(main)/events/[id]/edit/page.tsx` - イベント編集ページ

### カレンダーコンポーネント
- [x] `components/event/EventCalendar.tsx` - カレンダー表示
  - [x] 月表示
  - [ ] 週表示
  - [x] 日付クリックでイベント表示
- [x] `components/event/CalendarDay.tsx` - カレンダー日付セル
- [x] `components/event/CalendarEvent.tsx` - カレンダー上のイベント表示

### イベントコンポーネント
- [x] `components/event/EventCard.tsx` - イベントカード
- [x] `components/event/EventList.tsx` - イベントリスト
- [x] `components/event/EventDetail.tsx` - イベント詳細
- [x] `components/event/EventForm.tsx` - イベント登録/編集フォーム
- [x] `components/event/RegionFilter.tsx` - 地域フィルター

### イベント登録項目
**必須項目:**
- [x] タイトル入力
- [x] 開始日時選択
- [x] 終了日時選択（任意）
- [x] 都道府県選択
- [x] 市区町村入力

**任意項目:**
- [x] 会場名
- [x] 主催者情報
- [x] 入場料
- [x] 即売の有無（チェックボックス）
- [x] 詳細説明（テキストエリア）
- [x] 外部リンク（公式サイト、申し込みページ等）

### Server Actions
- [x] `lib/actions/event.ts`
  - [x] `createEvent` - イベント登録
  - [x] `updateEvent` - イベント更新
  - [x] `deleteEvent` - イベント削除
  - [x] `getEvent` - イベント詳細取得
  - [x] `getEvents` - イベント一覧取得
  - [x] `getUpcomingEvents` - 今後のイベント取得
  - [x] `getEventsByMonth` - 月別イベント取得
  - [x] `getEventsByRegion` - 地域別イベント取得

### 地域フィルター
- [x] 都道府県選択
- [x] 地方ブロック選択
  - [x] 北海道
  - [x] 東北（青森、岩手、宮城、秋田、山形、福島）
  - [x] 関東（茨城、栃木、群馬、埼玉、千葉、東京、神奈川）
  - [x] 中部（新潟、富山、石川、福井、山梨、長野、岐阜、静岡、愛知）
  - [x] 近畿（三重、滋賀、京都、大阪、兵庫、奈良、和歌山）
  - [x] 中国（鳥取、島根、岡山、広島、山口）
  - [x] 四国（徳島、香川、愛媛、高知）
  - [x] 九州・沖縄（福岡、佐賀、長崎、熊本、大分、宮崎、鹿児島、沖縄）
- [ ] 複数地域選択対応
- [x] フィルター状態のURL反映

### 終了イベント処理
- [x] 終了日が過去のイベントを自動非表示
- [x] 終了イベント表示切り替えオプション
- [ ] cronジョブでの自動アーカイブ（将来）

### 表示切り替え
- [x] カレンダー表示
- [x] リスト表示
- [x] 切り替えボタン

### 権限管理
- [x] 自分が登録したイベントのみ編集/削除可能
- [x] 通報機能連携

### 日付・時刻処理
- [x] 日本時間（JST）での表示
- [x] 日付フォーマット（YYYY年MM月DD日）
- [x] 曜日表示

### UI/UX
- [x] カレンダーのスムーズな操作
- [x] 月送りアニメーション
- [x] 今日の日付ハイライト
- [x] イベントのある日付のマーク
- [x] レスポンシブ対応

### 都道府県マスターデータ
- [x] 47都道府県のマスターデータ作成
- [x] 地方ブロックとの紐付け

---

## 完了条件
- [x] カレンダーが正常に表示される
- [x] イベント登録が正常に動作する
- [x] 地域フィルターが正常に動作する
- [x] 終了イベントが非表示になる
- [x] イベント詳細が正常に表示される

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

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getUpcomingEvents(region?: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const prefectures = region ? getPrefecturesByRegion(region) : undefined

  const events = await prisma.event.findMany({
    where: {
      startDate: { gte: today },
      ...(prefectures && { prefecture: { in: prefectures } }),
    },
    include: {
      user: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  return { events }
}

export async function createEvent(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: '認証が必要です' }
  }

  const title = formData.get('title') as string
  const startDate = new Date(formData.get('startDate') as string)
  const endDate = formData.get('endDate')
    ? new Date(formData.get('endDate') as string)
    : null
  const prefecture = formData.get('prefecture') as string
  const city = formData.get('city') as string | null
  const venue = formData.get('venue') as string | null
  const organizer = formData.get('organizer') as string | null
  const fee = formData.get('fee') as string | null
  const hasSales = formData.get('hasSales') === 'true'
  const description = formData.get('description') as string | null
  const externalUrl = formData.get('externalUrl') as string | null

  const event = await prisma.event.create({
    data: {
      userId: session.user.id,
      title,
      startDate,
      endDate,
      prefecture,
      city,
      venue,
      organizer,
      fee,
      hasSales,
      description,
      externalUrl,
    },
  })

  revalidatePath('/events')
  return { success: true, eventId: event.id }
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

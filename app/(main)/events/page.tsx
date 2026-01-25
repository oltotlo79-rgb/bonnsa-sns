/**
 * @file イベント一覧ページ
 * @description 盆栽関連イベントの一覧表示を提供するメインページ。
 * カレンダー表示とリスト表示の切り替え、地域フィルタリング、
 * 過去イベントの表示/非表示切り替えなどの機能を備える。
 */

// Next.jsのLinkコンポーネント: クライアントサイドナビゲーションを実現
import Link from 'next/link'
// ReactのSuspenseコンポーネント: 非同期コンポーネントのローディング制御
import { Suspense } from 'react'
// イベントデータ取得用のServer Action
import { getEvents } from '@/lib/actions/event'
// カレンダー表示用ラッパーコンポーネント
import { EventCalendarWrapper } from '@/components/event/EventCalendarWrapper'
// イベントリスト表示コンポーネント
import { EventList } from '@/components/event/EventList'
// 地域フィルターコンポーネント
import { RegionFilter } from '@/components/event/RegionFilter'
// 過去イベント表示切り替えコンポーネント
import { ShowPastToggle } from '@/components/event/ShowPastToggle'
// フィルター設定をlocalStorageに保存するコンポーネント
import { EventFilterPersistence } from '@/components/event/EventFilterPersistence'

/**
 * ページメタデータ
 * SEO対策としてタイトルを設定
 */
export const metadata = {
  title: 'イベント - BON-LOG',
}

/**
 * ページコンポーネントのProps型定義
 * URLのクエリパラメータを受け取る
 */
interface EventsPageProps {
  searchParams: Promise<{
    region?: string      // 地方ブロック（関東、近畿など）
    prefecture?: string  // 都道府県
    view?: string        // 表示モード（calendar / list）
    showPast?: string    // 過去イベント表示フラグ
  }>
}

/**
 * プラスアイコンコンポーネント
 * 新規登録ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

/**
 * カレンダーアイコンコンポーネント
 * カレンダー表示切り替えボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

/**
 * リストアイコンコンポーネント
 * リスト表示切り替えボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function ListIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="8" x2="21" y1="6" y2="6"/>
      <line x1="8" x2="21" y1="12" y2="12"/>
      <line x1="8" x2="21" y1="18" y2="18"/>
      <line x1="3" x2="3.01" y1="6" y2="6"/>
      <line x1="3" x2="3.01" y1="12" y2="12"/>
      <line x1="3" x2="3.01" y1="18" y2="18"/>
    </svg>
  )
}

/**
 * イベント一覧ページコンポーネント
 *
 * このServer Componentは以下の機能を提供する:
 * 1. URLパラメータに基づいたイベントデータの取得
 * 2. 地域（地方ブロック/都道府県）によるフィルタリング
 * 3. カレンダー表示とリスト表示の切り替え
 * 4. 過去イベントの表示/非表示切り替え
 * 5. フィルター設定のlocalStorageへの永続化
 *
 * @param searchParams - URLクエリパラメータ（地域、表示モード、過去イベント表示）
 */
export default async function EventsPage({ searchParams }: EventsPageProps) {
  // URLパラメータを非同期で取得
  const params = await searchParams
  // 表示モードの決定（デフォルトはカレンダー表示）
  const view = params.view || 'calendar'
  // 過去イベント表示フラグ
  const showPast = params.showPast === 'true'

  // イベントデータを取得（フィルター条件を適用）
  const { events } = await getEvents({
    region: params.region,        // 地方ブロックでフィルタ
    prefecture: params.prefecture, // 都道府県でフィルタ
    showPast,                     // 過去イベントの表示有無
  })

  return (
    <div className="space-y-6">
      {/* フィルター設定の永続化コンポーネント（UIなし、localStorageとURLを同期） */}
      <Suspense fallback={null}>
        <EventFilterPersistence />
      </Suspense>

      {/* ヘッダー: ページタイトルと新規登録ボタン */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">イベント</h1>
        <Link
          href="/events/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <PlusIcon className="w-4 h-4" />
          <span>イベントを登録</span>
        </Link>
      </div>

      {/* 地域フィルター: 地方ブロックと都道府県の選択 */}
      <Suspense fallback={<div className="h-40 bg-muted animate-pulse rounded-lg" />}>
        <RegionFilter
          currentRegion={params.region}
          currentPrefecture={params.prefecture}
        />
      </Suspense>

      {/* 表示切り替えセクション: カレンダー/リストと過去イベントの切り替え */}
      <div className="flex items-center justify-between">
        {/* 表示モード切り替えボタン */}
        <div className="flex items-center gap-2">
          {/* カレンダー表示ボタン */}
          <Link
            href={`/events?${new URLSearchParams({ ...params, view: 'calendar' }).toString()}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
              view === 'calendar'
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className="text-sm">カレンダー</span>
          </Link>
          {/* リスト表示ボタン */}
          <Link
            href={`/events?${new URLSearchParams({ ...params, view: 'list' }).toString()}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
              view === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            <ListIcon className="w-4 h-4" />
            <span className="text-sm">リスト</span>
          </Link>
        </div>

        {/* 過去イベント表示切り替えトグル */}
        <ShowPastToggle showPast={showPast} />
      </div>

      {/* イベント表示: カレンダーまたはリスト */}
      {view === 'calendar' ? (
        // カレンダー表示モード
        <EventCalendarWrapper events={events} />
      ) : (
        // リスト表示モード
        <div>
          <h2 className="text-lg font-semibold mb-4">
            イベント一覧
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({events.length}件)
            </span>
          </h2>
          <EventList
            events={events}
            emptyMessage="該当するイベントがありません"
          />
        </div>
      )}
    </div>
  )
}

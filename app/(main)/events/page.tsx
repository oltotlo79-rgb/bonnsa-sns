import Link from 'next/link'
import { Suspense } from 'react'
import { getEvents } from '@/lib/actions/event'
import { EventCalendarWrapper } from '@/components/event/EventCalendarWrapper'
import { EventList } from '@/components/event/EventList'
import { RegionFilter } from '@/components/event/RegionFilter'

export const metadata = {
  title: 'イベント - BON-LOG',
}

interface EventsPageProps {
  searchParams: Promise<{
    region?: string
    prefecture?: string
    view?: string
    showPast?: string
  }>
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

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

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams
  const view = params.view || 'calendar'
  const showPast = params.showPast === 'true'

  const { events } = await getEvents({
    region: params.region,
    prefecture: params.prefecture,
    showPast,
  })

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
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

      {/* フィルター */}
      <Suspense fallback={<div className="h-40 bg-muted animate-pulse rounded-lg" />}>
        <RegionFilter
          currentRegion={params.region}
          currentPrefecture={params.prefecture}
        />
      </Suspense>

      {/* 表示切り替え */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showPast}
            onChange={() => {}}
            className="w-4 h-4 rounded"
          />
          <Link
            href={`/events?${new URLSearchParams({
              ...params,
              showPast: showPast ? '' : 'true',
            }).toString()}`}
            className="text-muted-foreground hover:text-foreground"
          >
            終了イベントも表示
          </Link>
        </label>
      </div>

      {/* イベント表示 */}
      {view === 'calendar' ? (
        <EventCalendarWrapper events={events} />
      ) : (
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

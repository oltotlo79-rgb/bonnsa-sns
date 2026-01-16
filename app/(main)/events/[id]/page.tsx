import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { getEvent } from '@/lib/actions/event'
import { DeleteEventButton } from './DeleteEventButton'
import { EventJsonLd } from '@/components/seo/JsonLd'

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
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

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M13 5v2"/>
      <path d="M13 17v2"/>
      <path d="M13 11v2"/>
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'
  const result = await getEvent(id)

  if (result.error || !result.event) {
    return { title: 'イベントが見つかりません' }
  }

  const event = result.event
  const title = event.title
  const startDateStr = format(new Date(event.startDate), 'yyyy年M月d日', { locale: ja })
  const locationStr = [event.prefecture, event.city, event.venue].filter(Boolean).join(' ')
  const description = `${startDateStr}開催${locationStr ? `（${locationStr}）` : ''}${event.description ? ` - ${event.description.slice(0, 100)}` : ''}`

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title: `${title} - 盆栽イベント`,
      description,
      url: `${baseUrl}/events/${id}`,
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - 盆栽イベント`,
      description,
      images: ['/og-image.jpg'],
    },
  }
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params
  const result = await getEvent(id)

  if (result.error || !result.event) {
    notFound()
  }

  const event = result.event
  const now = new Date()
  const startDate = new Date(event.startDate)
  const endDate = event.endDate ? new Date(event.endDate) : null

  // イベントステータスの判定
  // 終了: endDateがあればendDate経過後、なければstartDate経過後
  const isEnded = endDate ? endDate < now : startDate < now
  // 開催中: startDate経過後かつendDate前（endDateがない場合は開催中にならない）
  const isOngoing = !isEnded && startDate <= now && endDate && endDate >= now

  const formatEventDateTime = (date: Date) => {
    return format(new Date(date), 'yyyy年M月d日(E) HH:mm', { locale: ja })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bon-log.com'
  const locationStr = [event.prefecture, event.city, event.venue].filter(Boolean).join(' ')

  return (
    <>
      <EventJsonLd
        name={event.title}
        startDate={new Date(event.startDate).toISOString()}
        endDate={event.endDate ? new Date(event.endDate).toISOString() : undefined}
        location={locationStr ? { name: event.venue || undefined, address: locationStr } : undefined}
        description={event.description || undefined}
        url={`${baseUrl}/events/${event.id}`}
        organizer={event.organizer || undefined}
        offers={event.admissionFee ? { price: event.admissionFee } : undefined}
      />
    <div className="space-y-6">
      {/* 戻るボタン */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>イベント一覧に戻る</span>
      </Link>

      {/* メインコンテンツ */}
      <div className="bg-card rounded-lg border">
        <div className="p-6">
          {/* ヘッダー */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {isEnded && (
                  <span className="text-xs px-2 py-0.5 bg-muted-foreground/20 text-muted-foreground rounded-full">
                    終了
                  </span>
                )}
                {isOngoing && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded-full">
                    開催中
                  </span>
                )}
                {event.hasSales && (
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                    即売あり
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold">{event.title}</h1>
            </div>

            {event.isOwner && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/events/${event.id}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
                >
                  <EditIcon className="w-4 h-4" />
                  <span>編集</span>
                </Link>
                <DeleteEventButton eventId={event.id} />
              </div>
            )}
          </div>

          {/* 詳細情報 */}
          <div className="space-y-4">
            {/* 日時 */}
            <div className="flex items-start gap-3">
              <CalendarIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p>{formatEventDateTime(event.startDate)}</p>
                {event.endDate && (
                  <p className="text-muted-foreground">
                    〜 {formatEventDateTime(event.endDate)}
                  </p>
                )}
              </div>
            </div>

            {/* 場所 */}
            <div className="flex items-start gap-3">
              <MapPinIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p>
                  {event.prefecture}
                  {event.city && ` ${event.city}`}
                </p>
                {event.venue && (
                  <p className="text-muted-foreground">{event.venue}</p>
                )}
              </div>
            </div>

            {/* 主催者 */}
            {event.organizer && (
              <div className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span>主催: {event.organizer}</span>
              </div>
            )}

            {/* 入場料 */}
            {event.admissionFee && (
              <div className="flex items-center gap-3">
                <TicketIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span>入場料: {event.admissionFee}</span>
              </div>
            )}

            {/* 外部リンク */}
            {event.externalUrl && (
              <div className="flex items-center gap-3">
                <ExternalLinkIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <a
                  href={event.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {event.externalUrl}
                </a>
              </div>
            )}
          </div>

          {/* 詳細説明 */}
          {event.description && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="font-semibold mb-3">詳細</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {event.description}
              </p>
            </div>
          )}

          {/* 登録者情報 */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              登録者:
              <Link
                href={`/users/${event.creator.id}`}
                className="ml-2 inline-flex items-center gap-2 hover:text-foreground"
              >
                {event.creator.avatarUrl ? (
                  <Image
                    src={event.creator.avatarUrl}
                    alt={event.creator.nickname}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 bg-muted rounded-full" />
                )}
                <span>{event.creator.nickname}</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

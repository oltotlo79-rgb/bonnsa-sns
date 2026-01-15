import { EventCard } from './EventCard'

interface Event {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  prefecture: string | null
  city: string | null
  venue: string | null
  admissionFee: string | null
  hasSales: boolean
}

interface EventListProps {
  events: Event[]
  emptyMessage?: string
}

export function EventList({ events, emptyMessage = 'イベントがありません' }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}

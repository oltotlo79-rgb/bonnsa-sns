'use client'

import dynamic from 'next/dynamic'

interface Event {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  prefecture: string | null
}

interface EventCalendarWrapperProps {
  events: Event[]
}

const EventCalendar = dynamic(
  () => import('./EventCalendar').then((mod) => mod.EventCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card rounded-lg border p-4">
        <div className="h-[500px] bg-muted animate-pulse rounded-lg" />
      </div>
    ),
  }
)

export function EventCalendarWrapper({ events }: EventCalendarWrapperProps) {
  return <EventCalendar events={events} />
}

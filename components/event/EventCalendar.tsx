'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns'
import { ja } from 'date-fns/locale'

interface Event {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  prefecture: string | null
}

interface EventCalendarProps {
  events: Event[]
  onMonthChange?: (year: number, month: number) => void
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6"/>
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}

export function EventCalendar({ events, onMonthChange }: EventCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate)
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart
      return day >= eventStart && day <= eventEnd
    })
  }

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    onMonthChange?.(newMonth.getFullYear(), newMonth.getMonth())
  }

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    onMonthChange?.(newMonth.getFullYear(), newMonth.getMonth())
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    onMonthChange?.(today.getFullYear(), today.getMonth())
  }

  return (
    <div className="bg-card rounded-lg border">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="前月"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </h2>
          <button
            onClick={handleToday}
            className="text-sm px-3 py-1 border rounded-lg hover:bg-muted transition-colors"
          >
            今日
          </button>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="次月"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : ''
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isCurrentDay = isToday(day)
          const dayOfWeek = day.getDay()

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-1 border-b border-r ${
                !isCurrentMonth ? 'bg-muted/30' : ''
              } ${index % 7 === 0 ? 'border-l' : ''}`}
            >
              <div
                className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  isCurrentDay
                    ? 'bg-primary text-primary-foreground'
                    : dayOfWeek === 0
                    ? 'text-red-500'
                    : dayOfWeek === 6
                    ? 'text-blue-500'
                    : ''
                } ${!isCurrentMonth ? 'text-muted-foreground' : ''}`}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block text-xs bg-primary/10 text-primary px-1 py-0.5 rounded truncate hover:bg-primary/20 transition-colors"
                  >
                    {event.title}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - 3}件
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

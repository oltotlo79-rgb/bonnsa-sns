'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface AnalogClockPickerProps {
  value: string // "HH:MM" format
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
}

type ClockMode = 'hours' | 'minutes'

export function AnalogClockPicker({
  value,
  onChange,
  label,
  disabled = false,
}: AnalogClockPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<ClockMode>('hours')
  const clockRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse time string
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const [h, m] = timeStr.split(':').map(Number)
    return {
      hours: isNaN(h) ? 9 : h,
      minutes: isNaN(m) ? 0 : m,
    }
  }

  const { hours, minutes } = parseTime(value)

  // Format time to string
  const formatTime = (h: number, m: number): string => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setMode('hours')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Calculate angle from center
  const getAngleFromCenter = useCallback((clientX: number, clientY: number): number => {
    if (!clockRef.current) return 0

    const rect = clockRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = clientX - centerX
    const deltaY = clientY - centerY

    // Convert to angle (0 = top, clockwise)
    let angle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI)
    if (angle < 0) angle += 360

    return angle
  }, [])

  // Handle clock interaction
  const handleClockInteraction = useCallback(
    (clientX: number, clientY: number, isEnd: boolean = false) => {
      const angle = getAngleFromCenter(clientX, clientY)

      if (mode === 'hours') {
        // Hours: 30 degrees per hour (360 / 12)
        let newHours = Math.round(angle / 30) % 12

        // Check if clicking inner ring (PM) or outer ring (AM)
        if (clockRef.current) {
          const rect = clockRef.current.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const distance = Math.sqrt(
            Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
          )
          const radius = rect.width / 2

          // Inner ring = PM (12-23), Outer ring = AM (0-11)
          if (distance < radius * 0.55) {
            // Inner ring (PM)
            newHours = newHours === 0 ? 12 : newHours + 12
          } else {
            // Outer ring (AM)
            newHours = newHours === 0 ? 0 : newHours
          }
        }

        onChange(formatTime(newHours, minutes))

        if (isEnd) {
          setMode('minutes')
        }
      } else {
        // Minutes: 6 degrees per minute (360 / 60)
        const newMinutes = Math.round(angle / 6) % 60
        onChange(formatTime(hours, newMinutes))

        if (isEnd) {
          setIsOpen(false)
          setMode('hours')
        }
      }
    },
    [mode, hours, minutes, onChange, getAngleFromCenter]
  )

  // Mouse/Touch handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    handleClockInteraction(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || e.buttons !== 1) return
    handleClockInteraction(e.clientX, e.clientY)
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (disabled) return
    handleClockInteraction(e.clientX, e.clientY, true)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.touches[0]
    handleClockInteraction(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.touches[0]
    handleClockInteraction(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.changedTouches[0]
    handleClockInteraction(touch.clientX, touch.clientY, true)
  }

  // Generate hour numbers
  const renderHourNumbers = () => {
    const outerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    const innerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

    return (
      <>
        {/* Outer ring (AM) */}
        {outerHours.map((hour, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180)
          const x = 50 + 38 * Math.cos(angle)
          const y = 50 + 38 * Math.sin(angle)
          const isSelected = hours === hour || (hour === 12 && hours === 0)

          return (
            <div
              key={`outer-${hour}`}
              className={`absolute w-8 h-8 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              style={{
                left: `calc(${x}% - 16px)`,
                top: `calc(${y}% - 16px)`,
              }}
            >
              {hour === 0 ? '00' : hour}
            </div>
          )
        })}
        {/* Inner ring (PM) */}
        {innerHours.map((hour, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180)
          const x = 50 + 24 * Math.cos(angle)
          const y = 50 + 24 * Math.sin(angle)
          const isSelected = hours === hour

          return (
            <div
              key={`inner-${hour}`}
              className={`absolute w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              style={{
                left: `calc(${x}% - 14px)`,
                top: `calc(${y}% - 14px)`,
              }}
            >
              {hour}
            </div>
          )
        })}
      </>
    )
  }

  // Generate minute numbers
  const renderMinuteNumbers = () => {
    const minuteMarks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

    return minuteMarks.map((minute, index) => {
      const angle = (index * 30 - 90) * (Math.PI / 180)
      const x = 50 + 38 * Math.cos(angle)
      const y = 50 + 38 * Math.sin(angle)
      const isSelected = minutes === minute

      return (
        <div
          key={minute}
          className={`absolute w-8 h-8 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
          style={{
            left: `calc(${x}% - 16px)`,
            top: `calc(${y}% - 16px)`,
          }}
        >
          {minute.toString().padStart(2, '0')}
        </div>
      )
    })
  }

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium mb-1 block">{label}</label>
      )}

      {/* Input field */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border bg-background text-left focus:outline-none focus:ring-2 focus:ring-primary ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
        }`}
      >
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-muted-foreground" />
          <span>{value || '--:--'}</span>
        </div>
      </button>

      {/* Clock picker dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-card border rounded-xl shadow-lg">
          {/* Time display */}
          <div className="flex items-center justify-center gap-1 mb-4">
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={`text-3xl font-bold px-2 py-1 rounded transition-colors ${
                mode === 'hours'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {hours.toString().padStart(2, '0')}
            </button>
            <span className="text-3xl font-bold">:</span>
            <button
              type="button"
              onClick={() => setMode('minutes')}
              className={`text-3xl font-bold px-2 py-1 rounded transition-colors ${
                mode === 'minutes'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {minutes.toString().padStart(2, '0')}
            </button>
          </div>

          {/* Clock face */}
          <div
            ref={clockRef}
            className="relative w-56 h-56 rounded-full bg-muted/50 border-2 select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1 bg-primary rounded-full z-10" />

            {/* Numbers */}
            {mode === 'hours' ? renderHourNumbers() : renderMinuteNumbers()}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setMode('hours')
              }}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setMode('hours')
              }}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

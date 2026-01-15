'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface ShowPastToggleProps {
  showPast: boolean
}

export function ShowPastToggle({ showPast }: ShowPastToggleProps) {
  const searchParams = useSearchParams()

  // 現在のパラメータを維持しながらshowPastを切り替え
  const newParams = new URLSearchParams(searchParams.toString())
  if (showPast) {
    newParams.delete('showPast')
  } else {
    newParams.set('showPast', 'true')
  }

  return (
    <Link
      href={`/events?${newParams.toString()}`}
      className="flex items-center gap-2 text-sm cursor-pointer"
    >
      <input
        type="checkbox"
        checked={showPast}
        readOnly
        className="w-4 h-4 rounded cursor-pointer"
      />
      <span className="text-muted-foreground hover:text-foreground">
        終了イベントも表示
      </span>
    </Link>
  )
}

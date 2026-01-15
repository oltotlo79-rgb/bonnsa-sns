'use client'

import { useState } from 'react'
import { ReportModal } from './ReportModal'
import type { ReportTargetType } from '@/lib/constants/report'

interface ReportButtonProps {
  targetType: ReportTargetType
  targetId: string
  variant?: 'icon' | 'text' | 'menu'
  className?: string
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" x2="4" y1="22" y2="15"/>
    </svg>
  )
}

export function ReportButton({ targetType, targetId, variant = 'menu', className }: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowModal(true)
  }

  return (
    <>
      {variant === 'icon' && (
        <button
          onClick={handleClick}
          className={`p-2 hover:bg-muted rounded-lg transition-colors ${className || ''}`}
          title="通報"
        >
          <FlagIcon className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {variant === 'text' && (
        <button
          onClick={handleClick}
          className={`flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground ${className || ''}`}
        >
          <FlagIcon className="w-4 h-4" />
          <span>通報する</span>
        </button>
      )}

      {variant === 'menu' && (
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 ${className || ''}`}
        >
          <FlagIcon className="w-4 h-4" />
          <span>通報する</span>
        </button>
      )}

      {showModal && (
        <ReportModal
          targetType={targetType}
          targetId={targetId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

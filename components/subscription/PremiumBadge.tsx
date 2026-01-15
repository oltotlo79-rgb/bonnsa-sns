'use client'

import { Crown } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type PremiumBadgeProps = {
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export function PremiumBadge({ size = 'sm', showTooltip = true }: PremiumBadgeProps) {
  const badge = (
    <span className="inline-flex items-center justify-center text-amber-500">
      <Crown className={sizeClasses[size]} fill="currentColor" />
    </span>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>プレミアム会員</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

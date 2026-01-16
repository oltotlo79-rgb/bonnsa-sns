'use client'

import { useTheme } from './ThemeProvider'

function SunIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
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
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function MonitorIcon({ className }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}

interface ThemeToggleProps {
  showLabel?: boolean
  className?: string
}

export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'ライト'
      case 'dark':
        return 'ダーク'
      case 'system':
        return 'システム'
    }
  }

  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon

  return (
    <button
      onClick={cycleTheme}
      className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors ${className}`}
      title={`現在: ${getLabel()}モード`}
    >
      <Icon className="w-5 h-5" />
      {showLabel && <span className="text-sm">{getLabel()}</span>}
    </button>
  )
}

// ドロップダウンメニュー用
interface ThemeSelectProps {
  className?: string
}

export function ThemeSelect({ className = '' }: ThemeSelectProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-muted-foreground">テーマ</label>
      <div className="flex gap-2">
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <SunIcon className="w-4 h-4" />
          <span className="text-sm">ライト</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <MoonIcon className="w-4 h-4" />
          <span className="text-sm">ダーク</span>
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <MonitorIcon className="w-4 h-4" />
          <span className="text-sm">自動</span>
        </button>
      </div>
    </div>
  )
}

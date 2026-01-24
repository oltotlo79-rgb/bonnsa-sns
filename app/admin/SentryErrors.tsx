'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

interface SentryIssue {
  id: string
  shortId: string
  title: string
  culprit: string
  level: 'error' | 'warning' | 'info' | 'debug' | 'fatal'
  status: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  permalink: string
}

interface SentryResponse {
  success: boolean
  issues?: SentryIssue[]
  error?: string
  helpText?: string
  helpUrl?: string
  dashboardUrl?: string
  fetchedAt?: string
  debug?: {
    url?: string
    tokenLength?: number
    org?: string
    project?: string
  }
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" x2="12" y1="8" y2="12"/>
      <line x1="12" x2="12.01" y1="16" y2="16"/>
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

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  )
}

function getLevelColor(level: string) {
  switch (level) {
    case 'fatal':
      return 'bg-purple-500/10 text-purple-600 border-purple-200'
    case 'error':
      return 'bg-red-500/10 text-red-600 border-red-200'
    case 'warning':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
    case 'info':
      return 'bg-blue-500/10 text-blue-600 border-blue-200'
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-200'
  }
}

function getLevelLabel(level: string) {
  switch (level) {
    case 'fatal':
      return '致命的'
    case 'error':
      return 'エラー'
    case 'warning':
      return '警告'
    case 'info':
      return '情報'
    default:
      return level
  }
}

export function SentryErrors() {
  const [data, setData] = useState<SentryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sentry')
      const json = await res.json()
      setData(json)
    } catch (error) {
      setData({ success: false, error: '取得に失敗しました' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
            <AlertCircleIcon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold">Sentryエラー</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!data?.success) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
              <AlertCircleIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Sentryエラー</h2>
          </div>
          <a
            href="https://bon-log.sentry.io/issues/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
          >
            Sentry <ExternalLinkIcon className="w-3 h-3" />
          </a>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">{data?.error}</p>
          {data?.helpText && (
            <p className="text-sm text-yellow-600 mt-1">{data.helpText}</p>
          )}
          {data?.debug && (
            <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
              <p>URL: {data.debug.url}</p>
              <p>Token長: {data.debug.tokenLength}</p>
              <p>Org: {data.debug.org} / Project: {data.debug.project}</p>
            </div>
          )}
          {data?.helpUrl && (
            <a
              href={data.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline mt-2 inline-block"
            >
              トークンを作成 →
            </a>
          )}
        </div>
      </div>
    )
  }

  const issues = data.issues || []

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
            <AlertCircleIcon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold">Sentryエラー</h2>
          {issues.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
              {issues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="更新"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
          <a
            href={data.dashboardUrl || 'https://bon-log.sentry.io/issues/'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
          >
            Sentry <ExternalLinkIcon className="w-3 h-3" />
          </a>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>未解決のエラーはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <a
              key={issue.id}
              href={issue.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getLevelColor(issue.level)}`}>
                      {getLevelLabel(issue.level)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {issue.shortId}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{issue.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {issue.culprit}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{issue.count}回</p>
                  <p className="mt-1">
                    {formatDistanceToNow(new Date(issue.lastSeen), {
                      addSuffix: true,
                      locale: ja,
                    })}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

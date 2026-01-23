'use client'

import { useState, useEffect } from 'react'
import type { ServiceUsage } from '@/lib/services/usage'

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
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

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" x2="12" y1="9" y2="13"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <path d="m15 9-6 6"/>
      <path d="m9 9 6 6"/>
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

// サービスのアイコン
const serviceIcons: Record<string, React.ReactNode> = {
  Vercel: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M24 22.525H0l12-21.05 12 21.05z"/>
    </svg>
  ),
  Supabase: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"/>
    </svg>
  ),
  Upstash: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  'Cloudflare R2': (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.2678-.2246-.2795-.5765-.4242-1.0197-.4454l-8.6727-.0726c-.0537 0-.0966-.0215-.1182-.0537a.1435.1435 0 0 1-.021-.1475c.0322-.0752.0966-.129.1767-.1366l8.7453-.0753c.9814-.0322 2.0412-.8125 2.3959-1.7618l.449-1.1997c.0216-.0537.0322-.1143.021-.1689-.4017-1.9526-2.1423-3.411-4.2195-3.411-1.9082 0-3.5318 1.2476-4.0917 2.9682-.389-.2903-.8716-.4242-1.4032-.3628-1.0037.1099-1.8105.9383-1.9312 1.9421-.0322.2687-.0161.5374.0429.7845-1.649.0752-2.9682 1.4315-2.9682 3.1091 0 .1689.0107.3378.0322.5068.0108.0752.0752.1289.1475.1289h12.814c.075 0 .1398-.0645.1582-.1398z"/>
    </svg>
  ),
  Resend: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm3.519 0L12 11.671 18.481 6H5.52zM20 7.329l-8 7-8-7V18h16V7.329z"/>
    </svg>
  ),
  Stripe: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  ),
  Sentry: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.845 0L6.057 9.13a7.932 7.932 0 0 1 4.084 5.318h1.518V9.85h2.549v9.637h-4.067c0-.302-.025-.6-.073-.893H8.51a6.27 6.27 0 0 0-3.137-4.241L2.19 19.488c-.873 1.449.209 3.267 1.923 3.267h3.168V20.21H5.203l2.457-4.073c.747.46 1.395 1.056 1.913 1.76.772 1.048 1.228 2.318 1.277 3.647h4.067a10.462 10.462 0 0 0-1.514-6.076 10.543 10.543 0 0 0-4.213-3.744l2.97-4.926a5.393 5.393 0 0 1 3.546 3.03h-1.977l2.456 4.073c.763-.47 1.425-1.083 1.944-1.798a7.962 7.962 0 0 0 1.29-2.506h2.514c-.225 1.376-.71 2.677-1.42 3.843a10.489 10.489 0 0 1-3.016 3.086l2.456 4.073h-2.88v2.545h5.807c1.714 0 2.796-1.818 1.922-3.267L13.91 2.505z"/>
    </svg>
  ),
}

// サービスの背景色
const serviceColors: Record<string, string> = {
  Vercel: 'bg-black text-white',
  Supabase: 'bg-emerald-600 text-white',
  Upstash: 'bg-emerald-500 text-white',
  'Cloudflare R2': 'bg-orange-500 text-white',
  Resend: 'bg-black text-white',
  Stripe: 'bg-indigo-600 text-white',
  Sentry: 'bg-purple-600 text-white',
}

function UsageCard({ service }: { service: ServiceUsage }) {
  const statusIcon = {
    ok: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
    warning: <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />,
    error: <XCircleIcon className="w-5 h-5 text-red-500" />,
    unconfigured: <SettingsIcon className="w-5 h-5 text-gray-400" />,
  }

  const statusLabel = {
    ok: '正常',
    warning: '警告',
    error: 'エラー',
    unconfigured: '未設定',
  }

  return (
    <div className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${serviceColors[service.name] || 'bg-gray-500 text-white'}`}>
            {serviceIcons[service.name] || (
              <div className="w-6 h-6 flex items-center justify-center text-sm font-bold">
                {service.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold">{service.name}</h3>
            <div className="flex items-center gap-1 text-sm">
              {statusIcon[service.status]}
              <span className={
                service.status === 'ok' ? 'text-green-600' :
                service.status === 'warning' ? 'text-yellow-600' :
                service.status === 'error' ? 'text-red-600' :
                'text-gray-500'
              }>
                {statusLabel[service.status]}
              </span>
            </div>
          </div>
        </div>

        <a
          href={service.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="ダッシュボードを開く"
        >
          <ExternalLinkIcon className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>

      {service.error && service.status !== 'ok' && (
        <p className="text-sm text-muted-foreground mb-3">{service.error}</p>
      )}

      {service.usage && service.usage.length > 0 && (
        <div className="space-y-3">
          {service.usage.map((item, index) => (
            <div key={index}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{item.unit}</span>
                <span className="font-medium">
                  {item.limit > 0
                    ? `${item.current.toLocaleString()} / ${item.limit.toLocaleString()}`
                    : item.current.toLocaleString()
                  }
                </span>
              </div>
              {item.limit > 0 && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      item.percentage >= 90
                        ? 'bg-red-500'
                        : item.percentage >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        更新: {new Date(service.lastUpdated).toLocaleString('ja-JP')}
      </p>
    </div>
  )
}

export function UsageCards() {
  const [services, setServices] = useState<ServiceUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchUsage = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/usage')
      if (!response.ok) {
        throw new Error('使用量の取得に失敗しました')
      }

      const data = await response.json()
      setServices(data.data)
      setLastFetched(new Date(data.fetchedAt))
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  if (loading && services.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="space-y-2">
                <div className="w-20 h-4 bg-muted rounded" />
                <div className="w-16 h-3 bg-muted rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-full h-2 bg-muted rounded-full" />
              <div className="w-3/4 h-2 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lastFetched && `最終更新: ${lastFetched.toLocaleString('ja-JP')}`}
        </p>
        <button
          onClick={fetchUsage}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {services.map((service) => (
          <UsageCard key={service.name} service={service} />
        ))}
      </div>

      {/* 環境変数設定ガイド */}
      {services.some(s => s.status === 'unconfigured') && (
        <div className="bg-muted/50 rounded-lg border p-4 mt-6">
          <h3 className="font-semibold mb-2">環境変数の設定</h3>
          <p className="text-sm text-muted-foreground mb-3">
            使用量を取得するには、各サービスのAPIキーを環境変数に設定してください。
          </p>
          <pre className="bg-card border rounded-lg p-3 text-xs overflow-x-auto">
{`# Vercel
VERCEL_TOKEN=your_vercel_token
VERCEL_TEAM_ID=your_team_id  # オプション

# Supabase
SUPABASE_ACCESS_TOKEN=your_access_token
SUPABASE_PROJECT_REF=your_project_ref

# Upstash
UPSTASH_EMAIL=your_email
UPSTASH_API_KEY=your_api_key
UPSTASH_REDIS_DATABASE_ID=your_database_id  # オプション

# Cloudflare R2
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Resend
RESEND_API_KEY=your_api_key

# Stripe
STRIPE_SECRET_KEY=your_secret_key

# Sentry
SENTRY_AUTH_TOKEN=your_auth_token
SENTRY_ORG=your_organization_slug`}
          </pre>
        </div>
      )}
    </div>
  )
}

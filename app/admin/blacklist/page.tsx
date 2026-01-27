/**
 * ブラックリスト管理ページ
 *
 * メールアドレスとデバイスのブラックリストを管理する管理者ページ。
 *
 * @route /admin/blacklist
 */

import { Suspense } from 'react'
import { getEmailBlacklist, getDeviceBlacklist } from '@/lib/actions/blacklist'
import { BlacklistTabs } from './BlacklistTabs'

export const metadata = {
  title: 'ブラックリスト管理 - BON-LOG 管理',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    tab?: 'email' | 'device'
    search?: string
    page?: string
  }>
}

export default async function BlacklistPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tab = params.tab || 'email'
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  // メールブラックリストを取得
  const emailResult = await getEmailBlacklist({
    search: tab === 'email' ? search : undefined,
    limit,
    offset: tab === 'email' ? offset : 0,
  })

  // デバイスブラックリストを取得
  const deviceResult = await getDeviceBlacklist({
    search: tab === 'device' ? search : undefined,
    limit,
    offset: tab === 'device' ? offset : 0,
  })

  const emailData = 'data' in emailResult ? emailResult.data : { items: [], total: 0 }
  const deviceData = 'data' in deviceResult ? deviceResult.data : { items: [], total: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ブラックリスト管理</h1>
      </div>

      <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-lg" />}>
        <BlacklistTabs
          tab={tab}
          search={search}
          page={page}
          limit={limit}
          emailItems={emailData?.items || []}
          emailTotal={emailData?.total || 0}
          deviceItems={deviceData?.items || []}
          deviceTotal={deviceData?.total || 0}
        />
      </Suspense>
    </div>
  )
}

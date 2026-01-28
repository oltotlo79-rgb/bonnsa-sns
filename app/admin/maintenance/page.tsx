/**
 * 管理者メンテナンスモード設定ページ
 */

import { getMaintenanceSettings } from '@/lib/actions/maintenance'
import { MaintenanceForm } from './MaintenanceForm'

export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  const settings = await getMaintenanceSettings()

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">メンテナンスモード</h1>
        <p className="text-muted-foreground">
          サービスを一時的に停止し、メンテナンス画面を表示します
        </p>
      </div>

      {/* 現在のステータス */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-4 h-4 rounded-full ${
              settings.enabled ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`}
          />
          <div>
            <p className="font-medium">
              現在のステータス:{' '}
              <span className={settings.enabled ? 'text-red-600' : 'text-green-600'}>
                {settings.enabled ? 'メンテナンス中' : '通常運用'}
              </span>
            </p>
            {settings.enabled && settings.endTime && (
              <p className="text-sm text-muted-foreground">
                終了予定: {new Date(settings.endTime).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>

        {/* 設定フォーム */}
        <MaintenanceForm settings={settings} />
      </div>

      {/* 注意事項 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-medium text-amber-800 mb-2">注意事項</h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>メンテナンス中は一般ユーザーがログインできなくなります</li>
          <li>管理者アカウントは通常通りアクセスできます</li>
          <li>以下のページはメンテナンス中もアクセス可能です：
            <ul className="ml-4 mt-1">
              <li>- トップページ（/）</li>
              <li>- ログインページ（/login）</li>
              <li>- 新規登録ページ（/register）</li>
              <li>- パスワードリセット（/password-reset）</li>
            </ul>
          </li>
          <li>終了時間を設定すると自動的にメンテナンスが終了します</li>
        </ul>
      </div>
    </div>
  )
}

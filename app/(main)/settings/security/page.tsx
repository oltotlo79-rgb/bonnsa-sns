/**
 * セキュリティ設定ページ
 *
 * 2段階認証（2FA）の設定を行うページです。
 *
 * @route /settings/security
 */

import { Metadata } from 'next'
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings'

export const metadata: Metadata = {
  title: 'セキュリティ設定 - BON-LOG',
  description: '2段階認証などのセキュリティ設定を管理します',
}

export default function SecuritySettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-card rounded-lg border">
        <h1 className="px-4 py-3 font-bold text-lg border-b">セキュリティ設定</h1>
        <div className="p-4">
          <TwoFactorSettings />
        </div>
      </div>
    </div>
  )
}

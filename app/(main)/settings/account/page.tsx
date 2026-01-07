import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PrivacyToggle } from '@/components/user/PrivacyToggle'
import { DeleteAccountButton } from '@/components/user/DeleteAccountButton'

export const metadata = {
  title: 'アカウント設定 - BON-LOG',
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    redirect('/login')
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, is_public')
    .eq('id', authUser.id)
    .single()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
            &larr; 設定に戻る
          </Link>
          <h1 className="font-bold text-lg mt-1">アカウント設定</h1>
        </div>

        <div className="divide-y">
          {/* 公開設定 */}
          <div className="p-4">
            <h2 className="font-medium mb-2">プライバシー設定</h2>
            <PrivacyToggle initialIsPublic={user.is_public} />
          </div>

          {/* アカウント削除 */}
          <div className="p-4">
            <h2 className="font-medium mb-2 text-destructive">危険な操作</h2>
            <DeleteAccountButton />
          </div>
        </div>
      </div>
    </div>
  )
}

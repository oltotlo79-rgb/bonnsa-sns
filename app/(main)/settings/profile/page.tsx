import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProfileEditForm } from '@/components/user/ProfileEditForm'

export const metadata = {
  title: 'プロフィール編集 - BON-LOG',
}

export default async function ProfileEditPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    redirect('/login')
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, nickname, bio, location, avatar_url, header_url')
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
          <h1 className="font-bold text-lg mt-1">プロフィール編集</h1>
        </div>

        <div className="p-4">
          <ProfileEditForm user={user} />
        </div>
      </div>
    </div>
  )
}

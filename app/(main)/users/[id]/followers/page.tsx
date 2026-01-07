import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserList } from '@/components/user/UserList'
import Link from 'next/link'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase
    .from('users')
    .select('nickname')
    .eq('id', id)
    .single()

  return {
    title: user ? `${user.nickname}のフォロワー - BON-LOG` : 'ユーザーが見つかりません',
  }
}

export default async function FollowersPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, nickname')
    .eq('id', id)
    .single()

  if (!user) {
    notFound()
  }

  const { data: followers } = await supabase
    .from('follows')
    .select(`
      follower:users!follows_follower_id_fkey(id, nickname, avatar_url, bio)
    `)
    .eq('following_id', id)
    .order('created_at', { ascending: false })

  const users = followers?.map(f => f.follower).filter(Boolean) || []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">フォロワー</h1>
        </div>

        <UserList
          users={users as { id: string; nickname: string; avatar_url: string | null; bio: string | null }[]}
          emptyMessage="フォロワーはいません"
        />
      </div>
    </div>
  )
}

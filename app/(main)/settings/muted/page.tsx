import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMutedUsers } from '@/lib/actions/mute'
import { MutedUserList } from '@/components/user/MutedUserList'

export const metadata: Metadata = {
  title: 'ミュート中のユーザー | BON-LOG',
  description: 'ミュート中のユーザー一覧',
}

export default async function MutedUsersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const { users } = await getMutedUsers()

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ミュート中のユーザー</h1>

      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>ミュート中のユーザーはいません</p>
        </div>
      ) : (
        <MutedUserList users={users} />
      )}
    </div>
  )
}

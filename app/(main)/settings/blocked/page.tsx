import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBlockedUsers } from '@/lib/actions/block'
import { BlockedUserList } from '@/components/user/BlockedUserList'

export const metadata: Metadata = {
  title: 'ブロック中のユーザー | BON-LOG',
  description: 'ブロック中のユーザー一覧',
}

export default async function BlockedUsersPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const { users } = await getBlockedUsers()

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ブロック中のユーザー</h1>

      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>ブロック中のユーザーはいません</p>
        </div>
      ) : (
        <BlockedUserList users={users} />
      )}
    </div>
  )
}

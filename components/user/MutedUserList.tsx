'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { unmuteUser } from '@/lib/actions/mute'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'

type User = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

type MutedUserListProps = {
  users: User[]
}

export function MutedUserList({ users }: MutedUserListProps) {
  return (
    <div className="space-y-4">
      {users.map((user) => (
        <MutedUserItem key={user.id} user={user} />
      ))}
    </div>
  )
}

function MutedUserItem({ user }: { user: User }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleUnmute() {
    setLoading(true)

    const result = await unmuteUser(user.id)

    if (result.error) {
      toast({
        title: 'エラー',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ミュートを解除しました',
        description: `${user.nickname}さんのミュートを解除しました`,
      })
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <Link href={`/users/${user.id}`}>
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 text-lg">
                {user.nickname[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        <div>
          <Link href={`/users/${user.id}`}>
            <p className="font-semibold hover:underline">{user.nickname}</p>
          </Link>
          {user.bio && (
            <p className="text-sm text-gray-600 line-clamp-1">{user.bio}</p>
          )}
        </div>
      </div>

      <Button
        onClick={handleUnmute}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {loading ? '...' : 'ミュート解除'}
      </Button>
    </div>
  )
}

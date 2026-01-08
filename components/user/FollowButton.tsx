'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toggleFollow } from '@/lib/actions/follow'
import { useRouter } from 'next/navigation'

type FollowButtonProps = {
  userId: string
  initialIsFollowing: boolean
}

export function FollowButton({ userId, initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)

    // Optimistic UI
    setIsFollowing(!isFollowing)

    const result = await toggleFollow(userId)

    if (result.error) {
      // ロールバック
      setIsFollowing(isFollowing)
      if (result.error === '認証が必要です') {
        router.push('/login')
      }
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={isFollowing ? 'outline' : 'default'}
      className={isFollowing ? '' : 'bg-bonsai-green hover:bg-bonsai-green/90'}
    >
      {loading ? '...' : isFollowing ? 'フォロー中' : 'フォローする'}
    </Button>
  )
}

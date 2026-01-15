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
  const [isHovered, setIsHovered] = useState(false)
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

  // ホバー時のテキストとスタイル
  const getButtonText = () => {
    if (loading) return '...'
    if (!isFollowing) return 'フォローする'
    if (isHovered) return 'フォロー解除'
    return 'フォロー中'
  }

  const getButtonClass = () => {
    if (!isFollowing) return 'bg-bonsai-green hover:bg-bonsai-green/90'
    if (isHovered) return 'border-red-500 text-red-500 hover:bg-red-50'
    return ''
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={isFollowing ? 'outline' : 'default'}
      className={getButtonClass()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {getButtonText()}
    </Button>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type FollowButtonProps = {
  userId: string
  initialIsFollowing: boolean
}

export function FollowButton({ userId, initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleClick() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (isFollowing) {
      // フォロー解除
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId)

      if (!error) {
        setIsFollowing(false)
      }
    } else {
      // フォロー
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: userId,
        })

      if (!error) {
        setIsFollowing(true)
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

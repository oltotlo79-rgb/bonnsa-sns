'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { muteUser, unmuteUser } from '@/lib/actions/mute'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

type MuteButtonProps = {
  userId: string
  nickname: string
  initialIsMuted: boolean
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function MuteButton({
  userId,
  nickname,
  initialIsMuted,
  variant = 'ghost',
  size = 'default',
}: MuteButtonProps) {
  const [isMuted, setIsMuted] = useState(initialIsMuted)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleMute() {
    setLoading(true)
    setShowDialog(false)

    // Optimistic UI
    setIsMuted(true)

    const result = await muteUser(userId)

    if (result.error) {
      // ロールバック
      setIsMuted(false)
      toast({
        title: 'エラー',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ミュートしました',
        description: `${nickname}さんをミュートしました`,
      })
    }

    setLoading(false)
    router.refresh()
  }

  async function handleUnmute() {
    setLoading(true)

    // Optimistic UI
    setIsMuted(false)

    const result = await unmuteUser(userId)

    if (result.error) {
      // ロールバック
      setIsMuted(true)
      toast({
        title: 'エラー',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ミュートを解除しました',
        description: `${nickname}さんのミュートを解除しました`,
      })
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => {
          if (isMuted) {
            handleUnmute()
          } else {
            setShowDialog(true)
          }
        }}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {loading ? '...' : isMuted ? 'ミュート解除' : 'ミュート'}
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{nickname}さんをミュートしますか?</AlertDialogTitle>
            <AlertDialogDescription>
              ミュートすると、以下の効果があります:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>タイムラインに投稿が表示されなくなります</li>
                <li>通知が表示されなくなります</li>
              </ul>
              フォロー関係は維持されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleMute}>ミュート</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

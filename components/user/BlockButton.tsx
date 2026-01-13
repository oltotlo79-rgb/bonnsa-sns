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
import { blockUser, unblockUser } from '@/lib/actions/block'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

type BlockButtonProps = {
  userId: string
  nickname: string
  initialIsBlocked: boolean
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function BlockButton({
  userId,
  nickname,
  initialIsBlocked,
  variant = 'ghost',
  size = 'default',
}: BlockButtonProps) {
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleBlock() {
    setLoading(true)
    setShowDialog(false)

    // Optimistic UI
    setIsBlocked(true)

    const result = await blockUser(userId)

    if (result.error) {
      // ロールバック
      setIsBlocked(false)
      toast({
        title: 'エラー',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ブロックしました',
        description: `${nickname}さんをブロックしました`,
      })
    }

    setLoading(false)
    router.refresh()
  }

  async function handleUnblock() {
    setLoading(true)

    // Optimistic UI
    setIsBlocked(false)

    const result = await unblockUser(userId)

    if (result.error) {
      // ロールバック
      setIsBlocked(true)
      toast({
        title: 'エラー',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ブロックを解除しました',
        description: `${nickname}さんのブロックを解除しました`,
      })
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => {
          if (isBlocked) {
            handleUnblock()
          } else {
            setShowDialog(true)
          }
        }}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {loading ? '...' : isBlocked ? 'ブロック解除' : 'ブロック'}
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{nickname}さんをブロックしますか?</AlertDialogTitle>
            <AlertDialogDescription>
              ブロックすると、以下の操作が行われます:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>相互フォローが解除されます</li>
                <li>相手の投稿が表示されなくなります</li>
                <li>相手からのコメントが表示されなくなります</li>
                <li>相手はあなたのプロフィールにアクセスできなくなります</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              className="bg-red-600 hover:bg-red-700"
            >
              ブロック
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

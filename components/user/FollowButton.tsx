/**
 * フォローボタンコンポーネント
 *
 * このファイルは、ユーザーをフォロー/フォロー解除するボタンを提供します。
 * プロフィールページやユーザーカードで使用されます。
 *
 * ## 機能概要
 * - フォロー/フォロー解除のトグル
 * - 非公開アカウントへのフォローリクエスト対応
 * - Optimistic UI（即時レスポンス）
 * - ホバー時のUI変化（フォロー中→フォロー解除に変化）
 *
 * ## 非公開アカウントの場合
 * - 「フォローリクエスト」ボタンを表示
 * - リクエスト送信後は「リクエスト済み」と表示
 * - クリックでリクエストをキャンセル可能
 *
 * ## スタイリング
 * - 未フォロー: 緑色の背景
 * - フォロー中: アウトラインスタイル
 * - ホバー時（フォロー中）: 赤色に変化
 * - リクエスト済み: アウトラインスタイル
 *
 * @module components/user/FollowButton
 */

'use client'

// ============================================================
// インポート
// ============================================================

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toggleFollow } from '@/lib/actions/follow'
import { sendFollowRequest, cancelFollowRequest } from '@/lib/actions/follow-request'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'

// ============================================================
// 型定義
// ============================================================

/**
 * FollowButtonコンポーネントのprops型
 *
 * @property userId - フォロー対象のユーザーID
 * @property initialIsFollowing - 初期のフォロー状態（true=フォロー中）
 * @property isPublic - 対象ユーザーが公開アカウントかどうか
 * @property initialHasRequest - 初期のリクエスト送信状態（true=リクエスト済み）
 */
type FollowButtonProps = {
  userId: string
  initialIsFollowing: boolean
  isPublic?: boolean
  initialHasRequest?: boolean
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * フォローボタンコンポーネント
 *
 * ## 機能
 * - 公開アカウント: クリックでフォロー/フォロー解除をトグル
 * - 非公開アカウント: フォローリクエストを送信/キャンセル
 * - Optimistic UIで即時フィードバック
 * - ホバー時に「フォロー解除」表示
 *
 * @param userId - フォロー対象のユーザーID
 * @param initialIsFollowing - 初期フォロー状態
 * @param isPublic - 公開アカウントかどうか（デフォルト: true）
 * @param initialHasRequest - リクエスト送信済みかどうか（デフォルト: false）
 *
 * @example
 * ```tsx
 * // 公開アカウント
 * <FollowButton
 *   userId="user123"
 *   initialIsFollowing={false}
 *   isPublic={true}
 * />
 *
 * // 非公開アカウント
 * <FollowButton
 *   userId="user456"
 *   initialIsFollowing={false}
 *   isPublic={false}
 *   initialHasRequest={false}
 * />
 * ```
 */
export function FollowButton({
  userId,
  initialIsFollowing,
  isPublic = true,
  initialHasRequest = false,
}: FollowButtonProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * フォロー状態
   * true: フォロー中, false: 未フォロー
   */
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)

  /**
   * フォローリクエスト送信状態（非公開アカウント用）
   * true: リクエスト送信済み, false: 未送信
   */
  const [hasRequest, setHasRequest] = useState(initialHasRequest)

  /**
   * ローディング状態
   * API呼び出し中はtrueになる
   */
  const [loading, setLoading] = useState(false)

  /**
   * ホバー状態
   * マウスがボタン上にある場合はtrue
   */
  const [isHovered, setIsHovered] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * 公開アカウントのフォロー/フォロー解除
   */
  async function handleFollow() {
    setLoading(true)
    setIsFollowing(!isFollowing)

    const result = await toggleFollow(userId)

    if (result.error) {
      setIsFollowing(isFollowing)
      if (result.error === '認証が必要です') {
        router.push('/login')
      } else {
        toast({
          title: 'エラー',
          description: result.error,
          variant: 'destructive',
        })
      }
    } else {
      // 成功時: React Queryキャッシュを無効化（タイムラインを更新）
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  /**
   * 非公開アカウントへのフォローリクエスト送信
   */
  async function handleSendRequest() {
    setLoading(true)
    setHasRequest(true)

    const result = await sendFollowRequest(userId)

    if ('error' in result) {
      setHasRequest(false)
      if (result.error === '認証が必要です') {
        router.push('/login')
      } else {
        toast({
          title: 'エラー',
          description: result.error,
          variant: 'destructive',
        })
      }
    } else {
      toast({
        title: 'リクエストを送信しました',
        description: '相手の承認をお待ちください',
      })
      // 成功時: React Queryキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  /**
   * フォローリクエストのキャンセル
   */
  async function handleCancelRequest() {
    setLoading(true)
    setHasRequest(false)

    const result = await cancelFollowRequest(userId)

    if (result.error) {
      setHasRequest(true)
      toast({
        title: 'エラー',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'リクエストをキャンセルしました',
      })
      // 成功時: React Queryキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  /**
   * ボタンクリックハンドラ
   */
  function handleClick() {
    if (isFollowing) {
      // フォロー中の場合はフォロー解除
      handleFollow()
    } else if (!isPublic && hasRequest) {
      // 非公開アカウントでリクエスト済みの場合はキャンセル
      handleCancelRequest()
    } else if (!isPublic) {
      // 非公開アカウントでリクエスト未送信の場合はリクエスト送信
      handleSendRequest()
    } else {
      // 公開アカウントでフォローしていない場合はフォロー
      handleFollow()
    }
  }

  // ------------------------------------------------------------
  // ヘルパー関数
  // ------------------------------------------------------------

  /**
   * ボタンテキストを取得
   */
  const getButtonText = () => {
    if (loading) return '...'
    if (isFollowing) {
      return isHovered ? 'フォロー解除' : 'フォロー中'
    }
    if (!isPublic) {
      if (hasRequest) {
        return isHovered ? 'キャンセル' : 'リクエスト済み'
      }
      return 'フォローリクエスト'
    }
    return 'フォローする'
  }

  /**
   * ボタンのCSSクラスを取得
   */
  const getButtonClass = () => {
    // フォロー中でホバー時は赤色
    if (isFollowing && isHovered) {
      return 'border-red-500 text-red-500 hover:bg-red-50'
    }
    // リクエスト済みでホバー時は赤色
    if (!isPublic && hasRequest && isHovered) {
      return 'border-red-500 text-red-500 hover:bg-red-50'
    }
    // 未フォロー/未リクエストは緑色
    if (!isFollowing && !hasRequest) {
      return 'bg-bonsai-green hover:bg-bonsai-green/90'
    }
    return ''
  }

  /**
   * ボタンのvariantを取得
   */
  const getButtonVariant = () => {
    if (isFollowing || hasRequest) {
      return 'outline'
    }
    return 'default'
  }

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={getButtonVariant()}
      className={getButtonClass()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {getButtonText()}
    </Button>
  )
}

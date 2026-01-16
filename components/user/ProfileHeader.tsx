'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FollowButton } from './FollowButton'
import { BlockButton } from './BlockButton'
import { MuteButton } from './MuteButton'
import { MessageButton } from '@/components/message/MessageButton'

type ProfileHeaderProps = {
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
    headerUrl: string | null
    bio: string | null
    location: string | null
    bonsaiStartYear: number | null
    bonsaiStartMonth: number | null
    isPublic: boolean
    createdAt: string | Date
    postsCount: number
    followersCount: number
    followingCount: number
  }
  isOwner: boolean
  isFollowing?: boolean
  isBlocked?: boolean
  isMuted?: boolean
  isPremium?: boolean
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" /><path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    </svg>
  )
}

function SproutIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  )
}

// 盆栽歴を計算
function calculateBonsaiExperience(startYear: number | null, startMonth: number | null): string | null {
  if (!startYear) return null

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const startMonthNum = startMonth || 1
  let years = currentYear - startYear
  let months = currentMonth - startMonthNum

  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years < 0) return null
  if (years === 0) {
    if (months === 0) return '1ヶ月未満'
    return `${months}ヶ月`
  }
  if (months === 0) return `${years}年`
  return `${years}年${months}ヶ月`
}

export function ProfileHeader({ user, isOwner, isFollowing, isBlocked, isMuted, isPremium }: ProfileHeaderProps) {
  const joinDate = new Date(user.createdAt)
  const formattedJoinDate = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月`
  const bonsaiExperience = calculateBonsaiExperience(user.bonsaiStartYear, user.bonsaiStartMonth)

  return (
    <div className="bg-card rounded-lg border">
      {/* ヘッダー画像とアバター */}
      <div className="relative">
        {/* ヘッダー画像 - relative z-0 を追加して背面に固定 */}
        <div className="h-32 sm:h-48 bg-bonsai-green/20 rounded-t-lg overflow-hidden relative z-0">
          {user.headerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.headerUrl}
              alt="ヘッダー画像"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* アバター（絶対配置でヘッダーの上に重ねる） - z-20 に引き上げ */}
        <div className="absolute left-4 -bottom-12 sm:-bottom-16 z-20">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-card bg-muted overflow-hidden">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.nickname}
                width={128}
                height={128}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl text-muted-foreground bg-card">
                {user.nickname.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* プロフィール情報 */}
      <div className="px-4 pb-4 pt-14 sm:pt-20">
        {/* 編集ボタン・アクションボタン */}
        <div className="flex justify-end gap-2 mb-4">
          {isOwner ? (
            <Button variant="outline" asChild>
              <Link href="/settings/profile">プロフィールを編集</Link>
            </Button>
          ) : (
            <>
              <MessageButton userId={user.id} isBlocked={isBlocked} />
              <FollowButton userId={user.id} initialIsFollowing={isFollowing ?? false} />
              <MuteButton
                userId={user.id}
                nickname={user.nickname}
                initialIsMuted={isMuted ?? false}
                size="default"
              />
              <BlockButton
                userId={user.id}
                nickname={user.nickname}
                initialIsBlocked={isBlocked ?? false}
                size="default"
              />
            </>
          )}
        </div>

        {/* 名前・プレミアムバッジ・非公開マーク */}
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold">{user.nickname}</h1>
          {isPremium && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded" title="プレミアム会員">
              <CrownIcon className="w-3 h-3" />
              Premium
            </span>
          )}
          {!user.isPublic && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              <LockIcon className="w-3 h-3" />
              非公開
            </span>
          )}
        </div>

        {/* 自己紹介 */}
        {user.bio && (
          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{user.bio}</p>
        )}

        {/* メタ情報 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-4 h-4" />
              {user.location}
            </span>
          )}
          {bonsaiExperience && (
            <span className="flex items-center gap-1">
              <SproutIcon className="w-4 h-4" />
              盆栽歴 {bonsaiExperience}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {formattedJoinDate}から利用
          </span>
        </div>

        {/* フォロー情報 */}
        <div className="flex gap-4 text-sm">
          <Link href={`/users/${user.id}/following`} className="hover:underline">
            <span className="font-bold">{user.followingCount}</span>
            <span className="text-muted-foreground ml-1">フォロー中</span>
          </Link>
          <Link href={`/users/${user.id}/followers`} className="hover:underline">
            <span className="font-bold">{user.followersCount}</span>
            <span className="text-muted-foreground ml-1">フォロワー</span>
          </Link>
          <span>
            <span className="font-bold">{user.postsCount}</span>
            <span className="text-muted-foreground ml-1">投稿</span>
          </span>
        </div>
      </div>
    </div>
  )
}
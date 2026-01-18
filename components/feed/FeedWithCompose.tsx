'use client'

import { useState } from 'react'
import { Timeline } from './Timeline'
import { PostFormModal } from '@/components/post/PostFormModal'

type Genre = {
  id: string
  name: string
  category: string
}

type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any

type FeedWithComposeProps = {
  initialPosts: Post[]
  currentUserId?: string
  genres: Record<string, Genre[]>
  limits: MembershipLimits
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

export function FeedWithCompose({ initialPosts, currentUserId, genres, limits }: FeedWithComposeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="relative min-h-screen">
      {/* タイムライン */}
      <div>
        <h2 className="text-lg font-bold mb-4">タイムライン</h2>
        <Timeline initialPosts={initialPosts} currentUserId={currentUserId} />
      </div>

      {/* フローティング投稿ボタン（タイムライン列の右下に固定） */}
      <div className="sticky bottom-20 md:bottom-6 pointer-events-none z-40">
        <div className="flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="pointer-events-auto w-14 h-14 bg-bonsai-green hover:bg-bonsai-green/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
            aria-label="新規投稿"
          >
            <PenIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 投稿モーダル */}
      <PostFormModal
        genres={genres}
        limits={limits}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

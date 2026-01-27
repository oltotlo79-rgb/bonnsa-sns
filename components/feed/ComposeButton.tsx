/**
 * @file 投稿作成ボタンコンポーネント
 * @description フローティング投稿ボタンと投稿モーダルを提供
 *
 * このコンポーネントは、画面右下に表示されるフローティングアクションボタン（FAB）と
 * 投稿作成モーダルを管理します。FeedWithComposeから分離され、
 * タイムラインとは独立してレンダリングできるようになっています。
 *
 * ## Suspense対応
 * このコンポーネントは投稿フォームに必要なデータ（ジャンル、制限等）のみを受け取り、
 * タイムラインデータに依存しません。これにより、タイムラインがSuspenseで
 * ストリーミング中でも、投稿ボタンは即座に表示されます。
 *
 * @module components/feed/ComposeButton
 */

'use client'

// ============================================================
// インポート
// ============================================================

import { useState } from 'react'
import { PostFormModal } from '@/components/post/PostFormModal'

// ============================================================
// 型定義
// ============================================================

/**
 * ジャンルの型
 */
type Genre = {
  id: string
  name: string
  category: string
}

/**
 * 会員種別による投稿制限の型
 */
type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

/**
 * 盆栽の型
 */
type Bonsai = {
  id: string
  name: string
  species: string | null
}

/**
 * ComposeButtonコンポーネントのprops型
 */
type ComposeButtonProps = {
  genres: Record<string, Genre[]>
  limits: MembershipLimits
  draftCount?: number
  bonsais?: Bonsai[]
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * ペンアイコンコンポーネント
 */
function PenIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 投稿作成ボタンコンポーネント
 *
 * フローティングアクションボタン（FAB）と投稿モーダルを提供。
 * タイムラインとは独立してレンダリングされるため、
 * Suspenseと組み合わせてUXを向上できます。
 *
 * @param genres - カテゴリ別ジャンル一覧
 * @param limits - 会員種別による投稿制限
 * @param draftCount - 下書き件数
 * @param bonsais - ユーザーの盆栽一覧
 */
export function ComposeButton({
  genres,
  limits,
  draftCount = 0,
  bonsais = [],
}: ComposeButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      {/* フローティング投稿ボタン（FAB） */}
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        genres={genres}
        limits={limits}
        draftCount={draftCount}
        bonsais={bonsais}
      />
    </>
  )
}

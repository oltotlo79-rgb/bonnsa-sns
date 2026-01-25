/**
 * @file レビューアクションドロップダウンコンポーネント
 * @description レビュー管理テーブルの各行で使用されるドロップダウンメニュー。
 *              レビューの削除などの操作を提供する。
 */

'use client'

// ReactのuseStateとuseRefフック（状態管理とDOM参照用）
import { useState, useRef } from 'react'
// Next.jsのルーター（ページ更新用）
import { useRouter } from 'next/navigation'
// Next.jsのLinkコンポーネント（盆栽園確認リンク用）
import Link from 'next/link'
// レビュー削除用のServer Action
import { deleteReviewByAdmin } from '@/lib/actions/admin'

/**
 * 縦三点メニューアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  )
}

/**
 * ReviewActionsDropdownコンポーネントのProps型定義
 */
interface ReviewActionsDropdownProps {
  /** 操作対象のレビューID */
  reviewId: string
  /** レビュー対象の盆栽園ID */
  shopId: string
}

/**
 * レビューアクションドロップダウンコンポーネント
 * レビューに対する管理操作（確認/削除）を提供するドロップダウンメニュー
 *
 * @param reviewId - 操作対象のレビューID
 * @param shopId - レビュー対象の盆栽園ID
 * @returns ドロップダウンメニューのJSX要素
 *
 * 機能:
 * - 盆栽園詳細ページへのリンク
 * - レビュー削除（理由入力モーダル付き）
 * - メニュー位置の自動調整（画面端対応）
 */
export function ReviewActionsDropdown({ reviewId, shopId }: ReviewActionsDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < 80

      if (openUpward) {
        setMenuStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.right - 150,
        })
      } else {
        setMenuStyle({
          top: rect.bottom + 4,
          left: rect.right - 150,
        })
      }
    }
    setIsOpen(!isOpen)
  }

  const handleDelete = async () => {
    if (!reason.trim()) {
      alert('削除理由を入力してください')
      return
    }

    setIsSubmitting(true)
    const result = await deleteReviewByAdmin(reviewId, reason)
    setIsSubmitting(false)

    if (result.error) {
      alert(result.error)
      return
    }

    setShowDeleteModal(false)
    setReason('')
    router.refresh()
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <MoreVerticalIcon className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="fixed bg-card border rounded-lg shadow-lg py-1 z-[101] min-w-[150px]"
              style={menuStyle}
            >
              <Link
                href={`/shops/${shopId}`}
                target="_blank"
                className="block px-4 py-2 text-sm hover:bg-muted"
                onClick={() => setIsOpen(false)}
              >
                盆栽園を確認
              </Link>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowDeleteModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-red-600"
              >
                レビューを削除
              </button>
            </div>
          </>
        )}
      </div>

      {/* 削除モーダル */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">レビューを削除</h3>
            <p className="text-sm text-muted-foreground mb-4">
              このレビューを削除します。削除理由を入力してください。
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="削除理由"
              className="w-full px-3 py-2 border rounded-lg bg-background min-h-[100px] mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {isSubmitting ? '処理中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

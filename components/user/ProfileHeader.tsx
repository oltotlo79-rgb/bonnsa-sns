/**
 * プロフィールヘッダーコンポーネント
 *
 * このファイルは、ユーザープロフィールページのヘッダー部分を表示するコンポーネントを提供します。
 * ヘッダー画像、アバター、ユーザー情報、フォロー情報などを一覧表示します。
 *
 * ## 機能概要
 * - ヘッダー画像とアバター画像の表示
 * - ニックネーム、プレミアムバッジ、非公開マークの表示
 * - 自己紹介文の表示
 * - 居住地域、盆栽歴、登録日などのメタ情報表示
 * - フォロー数、フォロワー数、投稿数の表示
 * - プロフィール編集ボタン（自分の場合）
 * - フォロー、ミュート、ブロックボタン（他人の場合）
 *
 * ## 使用場所
 * - /users/[id] ユーザープロフィールページ
 *
 * @module components/user/ProfileHeader
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * Next.js Imageコンポーネント
 * アバター画像の最適化表示に使用
 */
import Image from 'next/image'

/**
 * Next.js Linkコンポーネント
 * プロフィール編集ページやフォロー一覧へのリンクに使用
 */
import Link from 'next/link'

/**
 * shadcn/ui Buttonコンポーネント
 * プロフィール編集ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * フォローボタンコンポーネント
 * 他ユーザーをフォロー/フォロー解除する
 */
import { FollowButton } from './FollowButton'

/**
 * ブロックボタンコンポーネント
 * 他ユーザーをブロック/ブロック解除する
 */
import { BlockButton } from './BlockButton'

/**
 * ミュートボタンコンポーネント
 * 他ユーザーをミュート/ミュート解除する
 */
import { MuteButton } from './MuteButton'

/**
 * メッセージボタンコンポーネント
 * 他ユーザーにダイレクトメッセージを送信する
 */
import { MessageButton } from '@/components/message/MessageButton'

// ============================================================
// 型定義
// ============================================================

/**
 * ProfileHeaderコンポーネントのprops型
 *
 * @property user - 表示するユーザー情報
 * @property user.id - ユーザーの一意識別子
 * @property user.nickname - ユーザーの表示名
 * @property user.avatarUrl - アバター画像のURL（nullの場合はイニシャル表示）
 * @property user.headerUrl - ヘッダー画像のURL（nullの場合はデフォルト背景）
 * @property user.bio - 自己紹介文（nullの場合は非表示）
 * @property user.location - 居住地域（nullの場合は非表示）
 * @property user.bonsaiStartYear - 盆栽を始めた年（nullの場合は盆栽歴非表示）
 * @property user.bonsaiStartMonth - 盆栽を始めた月（nullの場合は1月として計算）
 * @property user.isPublic - アカウントの公開状態（true=公開, false=非公開）
 * @property user.createdAt - アカウント登録日
 * @property user.postsCount - 投稿数
 * @property user.followersCount - フォロワー数
 * @property user.followingCount - フォロー中の数
 * @property isOwner - 自分のプロフィールかどうか（true=自分）
 * @property isFollowing - 現在フォロー中かどうか
 * @property isBlocked - 現在ブロック中かどうか
 * @property isMuted - 現在ミュート中かどうか
 * @property isPremium - プレミアム会員かどうか
 */
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

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * 地図ピンアイコン
 * 居住地域の表示に使用
 *
 * @param className - 追加するCSSクラス
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/**
 * カレンダーアイコン
 * 登録日の表示に使用
 *
 * @param className - 追加するCSSクラス
 */
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" /><path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

/**
 * 鍵アイコン
 * 非公開アカウントの表示に使用
 *
 * @param className - 追加するCSSクラス
 */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

/**
 * 王冠アイコン
 * プレミアム会員バッジの表示に使用
 *
 * @param className - 追加するCSSクラス
 */
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    </svg>
  )
}

/**
 * 芽アイコン
 * 盆栽歴の表示に使用
 *
 * @param className - 追加するCSSクラス
 */
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

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 盆栽歴を計算する
 *
 * 盆栽を始めた年月から現在までの期間を計算し、
 * 「X年Yヶ月」形式の文字列として返す。
 *
 * ## 戻り値の例
 * - 1年未満: 「6ヶ月」
 * - 開始直後: 「1ヶ月未満」
 * - 1年以上: 「3年2ヶ月」
 * - ぴったり年数: 「5年」
 *
 * @param startYear - 盆栽を始めた年（nullの場合はnullを返す）
 * @param startMonth - 盆栽を始めた月（nullの場合は1月として計算）
 * @returns 盆栽歴の文字列（開始年がnullの場合はnull）
 */
function calculateBonsaiExperience(startYear: number | null, startMonth: number | null): string | null {
  // 開始年が未設定の場合は盆栽歴を表示しない
  if (!startYear) return null

  // 現在の年月を取得
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // 開始月が未設定の場合は1月として計算
  const startMonthNum = startMonth || 1

  // 年数と月数を計算
  let years = currentYear - startYear
  let months = currentMonth - startMonthNum

  // 月がマイナスの場合は年を1減らして月を調整
  if (months < 0) {
    years -= 1
    months += 12
  }

  // 未来の日付が設定されている場合はnullを返す
  if (years < 0) return null

  // 結果をフォーマット
  if (years === 0) {
    if (months === 0) return '1ヶ月未満'
    return `${months}ヶ月`
  }
  if (months === 0) return `${years}年`
  return `${years}年${months}ヶ月`
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * プロフィールヘッダーコンポーネント
 *
 * ## 機能
 * - ヘッダー画像とアバターを重ねて表示
 * - ユーザー名とバッジ（プレミアム、非公開）を表示
 * - 自己紹介文を改行を保持して表示
 * - メタ情報（居住地、盆栽歴、登録日）を表示
 * - フォロー/フォロワー/投稿数を表示
 * - 自分の場合はプロフィール編集ボタンを表示
 * - 他人の場合はフォロー、メッセージ、ミュート、ブロックボタンを表示
 *
 * ## レイアウト
 * - 上部: ヘッダー画像（高さ128px〜192px）
 * - ヘッダー下端: アバター画像（一部重なる）
 * - 中央: ユーザー情報
 * - 下部: フォロー情報
 *
 * @param user - ユーザー情報
 * @param isOwner - 自分のプロフィールかどうか
 * @param isFollowing - フォロー中かどうか
 * @param isBlocked - ブロック中かどうか
 * @param isMuted - ミュート中かどうか
 * @param isPremium - プレミアム会員かどうか
 *
 * @example
 * ```tsx
 * <ProfileHeader
 *   user={userData}
 *   isOwner={false}
 *   isFollowing={true}
 *   isBlocked={false}
 *   isMuted={false}
 *   isPremium={true}
 * />
 * ```
 */
export function ProfileHeader({ user, isOwner, isFollowing, isBlocked, isMuted, isPremium }: ProfileHeaderProps) {
  // 登録日をフォーマット（例: 2024年1月）
  const joinDate = new Date(user.createdAt)
  const formattedJoinDate = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月`

  // 盆栽歴を計算
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
            // 自分のプロフィールの場合: プロフィール編集ボタン
            <Button variant="outline" asChild>
              <Link href="/settings/profile">プロフィールを編集</Link>
            </Button>
          ) : (
            // 他人のプロフィールの場合: アクションボタン群
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
          {/* プレミアム会員バッジ */}
          {isPremium && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded" title="プレミアム会員">
              <CrownIcon className="w-3 h-3" />
              Premium
            </span>
          )}
          {/* 非公開アカウントマーク */}
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

        {/* メタ情報（居住地、盆栽歴、登録日） */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
          {/* 居住地域 */}
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-4 h-4" />
              {user.location}
            </span>
          )}
          {/* 盆栽歴 */}
          {bonsaiExperience && (
            <span className="flex items-center gap-1">
              <SproutIcon className="w-4 h-4" />
              盆栽歴 {bonsaiExperience}
            </span>
          )}
          {/* 登録日 */}
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {formattedJoinDate}から利用
          </span>
        </div>

        {/* フォロー情報 */}
        <div className="flex gap-4 text-sm">
          {/* フォロー中 */}
          <Link href={`/users/${user.id}/following`} className="hover:underline">
            <span className="font-bold">{user.followingCount}</span>
            <span className="text-muted-foreground ml-1">フォロー中</span>
          </Link>
          {/* フォロワー */}
          <Link href={`/users/${user.id}/followers`} className="hover:underline">
            <span className="font-bold">{user.followersCount}</span>
            <span className="text-muted-foreground ml-1">フォロワー</span>
          </Link>
          {/* 投稿数 */}
          <span>
            <span className="font-bold">{user.postsCount}</span>
            <span className="text-muted-foreground ml-1">投稿</span>
          </span>
        </div>
      </div>
    </div>
  )
}

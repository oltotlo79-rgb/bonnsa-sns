/**
 * フィード + 投稿作成コンポーネント
 *
 * このファイルは、タイムライン表示とフローティング投稿ボタン、
 * 投稿モーダルを組み合わせたコンポーネントを提供します。
 * フィードページのメインコンテナとして使用されます。
 *
 * ## 機能概要
 * - タイムラインの表示（Timelineコンポーネントを内包）
 * - フローティング投稿ボタン（画面右下に固定表示）
 * - 投稿モーダルの表示/非表示制御
 * - 会員種別に応じた投稿制限の適用
 *
 * ## 技術的特徴
 * - Client Component（状態管理とイベントハンドラのため）
 * - レスポンシブデザイン（モバイル/デスクトップ対応）
 * - モーダルによる投稿フォームの表示
 *
 * ## 使用例
 * ```tsx
 * <FeedWithCompose
 *   initialPosts={posts}
 *   currentUserId={session?.user?.id}
 *   genres={genresByCategory}
 *   limits={membershipLimits}
 *   draftCount={drafts.length}
 *   bonsais={userBonsais}
 * />
 * ```
 *
 * @module components/feed/FeedWithCompose
 */

'use client'

// ============================================================
// インポート
// ============================================================

/**
 * React useState Hook
 * モーダルの開閉状態を管理するために使用
 */
import { useState } from 'react'

/**
 * タイムラインコンポーネント
 * 投稿一覧の無限スクロール表示を担当
 */
import { Timeline } from './Timeline'

/**
 * 投稿フォームモーダル
 * 新規投稿の作成UI
 */
import { PostFormModal } from '@/components/post/PostFormModal'

// ============================================================
// 型定義
// ============================================================

/**
 * ジャンルの型
 *
 * @property id - ジャンルの一意識別子
 * @property name - ジャンル名（例: 松柏類、雑木類）
 * @property category - ジャンルのカテゴリ（例: 樹種、用品）
 */
type Genre = {
  /** ジャンルの一意識別子 */
  id: string
  /** ジャンル名（例: 松柏類、雑木類） */
  name: string
  /** ジャンルのカテゴリ（例: 樹種、用品） */
  category: string
}

/**
 * 会員種別による投稿制限の型
 *
 * 無料会員・有料会員で異なる制限値が設定される
 *
 * @property maxPostLength - 投稿の最大文字数
 * @property maxImages - 1投稿あたりの最大画像数
 * @property maxVideos - 1投稿あたりの最大動画数
 * @property canSchedulePost - 予約投稿が可能かどうか
 * @property canViewAnalytics - 分析機能にアクセス可能かどうか
 */
type MembershipLimits = {
  /** 投稿の最大文字数（無料: 500、有料: 2000等） */
  maxPostLength: number
  /** 1投稿あたりの最大画像数 */
  maxImages: number
  /** 1投稿あたりの最大動画数 */
  maxVideos: number
  /** 予約投稿機能の利用可否 */
  canSchedulePost: boolean
  /** 投稿分析機能の利用可否 */
  canViewAnalytics: boolean
}

/**
 * 盆栽の型
 *
 * ユーザーが登録している盆栽情報
 * 投稿時に関連付けることができる
 *
 * @property id - 盆栽の一意識別子
 * @property name - 盆栽の名前
 * @property species - 樹種（null許容）
 */
type Bonsai = {
  /** 盆栽の一意識別子 */
  id: string
  /** 盆栽の名前（ユーザーが付けた愛称等） */
  name: string
  /** 樹種（例: 黒松、真柏）、未設定の場合null */
  species: string | null
}

/**
 * 投稿の型
 *
 * 注意: 現在は any を使用していますが、
 * 厳密な型定義は lib/types 配下に定義することを推奨
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any

/**
 * FeedWithComposeコンポーネントのprops型
 *
 * @property initialPosts - SSRで取得した初期投稿データ
 * @property currentUserId - 現在のユーザーID（いいね状態等の判定に使用）
 * @property genres - カテゴリ別に分類されたジャンル一覧
 * @property limits - 会員種別に応じた投稿制限
 * @property draftCount - 下書き投稿の件数（任意）
 * @property bonsais - ユーザーが登録している盆栽一覧（任意）
 */
type FeedWithComposeProps = {
  /** SSRで取得した初期投稿データ */
  initialPosts: Post[]
  /** 現在ログイン中のユーザーID */
  currentUserId?: string
  /** カテゴリ別に分類されたジャンル一覧（Record<カテゴリ名, ジャンル配列>） */
  genres: Record<string, Genre[]>
  /** 会員種別による投稿制限 */
  limits: MembershipLimits
  /** 下書き投稿の件数 */
  draftCount?: number
  /** ユーザーが登録している盆栽一覧 */
  bonsais?: Bonsai[]
}

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * ペンアイコンコンポーネント
 *
 * 新規投稿ボタンに使用されるSVGアイコン
 * 編集・作成を示す鉛筆/ペンのデザイン
 *
 * @param className - 追加するCSSクラス
 */
function PenIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* ペン本体とペン先を描画するパス */}
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * フィード + 投稿作成コンポーネント
 *
 * ## 機能
 * - タイムラインの表示
 * - フローティング投稿ボタン（FAB: Floating Action Button）
 * - 投稿モーダルの制御
 *
 * ## レイアウト構造
 * ```
 * ┌─────────────────────────┐
 * │ タイムライン見出し        │
 * ├─────────────────────────┤
 * │                         │
 * │     投稿一覧             │
 * │     (Timeline)          │
 * │                         │
 * │                    [+]  │ ← フローティングボタン
 * └─────────────────────────┘
 * ```
 *
 * @param initialPosts - SSRで取得した初期投稿データ
 * @param currentUserId - 現在のユーザーID
 * @param genres - カテゴリ別ジャンル一覧
 * @param limits - 会員種別による投稿制限
 * @param draftCount - 下書き件数
 * @param bonsais - ユーザーの盆栽一覧
 *
 * @example
 * ```tsx
 * // Server Componentから呼び出し
 * const posts = await getTimeline()
 * const genres = await getGenres()
 *
 * <FeedWithCompose
 *   initialPosts={posts}
 *   currentUserId={session?.user?.id}
 *   genres={genres}
 *   limits={membershipLimits}
 * />
 * ```
 */
export function FeedWithCompose({ initialPosts, currentUserId, genres, limits, draftCount = 0, bonsais = [] }: FeedWithComposeProps) {
  // ------------------------------------------------------------
  // State管理
  // ------------------------------------------------------------

  /**
   * 投稿モーダルの開閉状態
   *
   * true: モーダルが開いている（投稿フォーム表示中）
   * false: モーダルが閉じている
   *
   * フローティングボタンクリックでtrue、
   * モーダル外クリックまたは投稿完了でfalseになる
   */
  const [isModalOpen, setIsModalOpen] = useState(false)

  // ------------------------------------------------------------
  // イベントハンドラ
  // ------------------------------------------------------------

  /**
   * フローティングボタンクリック時の処理
   *
   * 投稿モーダルを開く
   * onClick={() => setIsModalOpen(true)}
   */

  /**
   * モーダルを閉じる処理
   *
   * 投稿完了時、キャンセル時、モーダル外クリック時に呼ばれる
   * onClose={() => setIsModalOpen(false)}
   */

  // ------------------------------------------------------------
  // レンダリング
  // ------------------------------------------------------------

  return (
    <div className="relative min-h-screen">
      {/*
        タイムラインセクション
        - 見出しと投稿一覧を表示
        - Timelineコンポーネントに投稿データと現在ユーザーを渡す
      */}
      <div>
        <h2 className="text-lg font-bold mb-4">タイムライン</h2>
        <Timeline initialPosts={initialPosts} currentUserId={currentUserId} />
      </div>

      {/*
        フローティング投稿ボタン（FAB: Floating Action Button）

        配置:
        - sticky: スクロールに追従して画面内に留まる
        - bottom-20: モバイルでボトムナビと重ならないよう余白確保
        - md:bottom-6: デスクトップでは下部に近く配置

        スタイル:
        - pointer-events-none: コンテナ自体はクリックを透過
        - z-40: 他の要素より前面に表示

        ボタン:
        - pointer-events-auto: ボタンのみクリック可能
        - hover:scale-105: ホバー時に少し拡大
      */}
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

      {/*
        投稿モーダル

        isOpenがtrueの時にモーダルが表示される
        onCloseでモーダルを閉じる処理を渡す

        genresとlimitsで投稿フォームの挙動を制御
        draftCountで下書き件数を表示
        bonsaisで投稿に関連付ける盆栽を選択可能に
      */}
      <PostFormModal
        genres={genres}
        limits={limits}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        draftCount={draftCount}
        bonsais={bonsais}
      />
    </div>
  )
}

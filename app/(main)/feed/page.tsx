/**
 * @file タイムラインページ
 * @description ユーザーのメインタイムライン（フィード）を表示するページ
 *
 * このファイルはBON-LOGのメインコンテンツであるタイムラインページを定義します。
 * フォロー中のユーザーの投稿や自分の投稿を時系列で表示し、
 * 新規投稿の作成機能も提供します。
 *
 * ## Suspense対応
 * タイムラインデータの取得はSuspense境界内で行われ、
 * 投稿ボタンは即座に表示されます。これにより、
 * ユーザーはタイムライン読み込み中でも投稿を開始できます。
 *
 * @features
 * - タイムライン表示（フォロー中ユーザーの投稿）
 * - 新規投稿フォーム（即座に表示）
 * - Suspenseによるストリーミングレンダリング
 * - 無限スクロール対応
 * - プレミアム会員向け機能の制限表示
 * - 下書き投稿数の表示
 */

import { Suspense } from 'react'

// NextAuth.jsの認証ヘルパー関数
import { auth } from '@/lib/auth'

// タイムラインコンポーネント
import { Timeline } from '@/components/feed/Timeline'

// タイムラインスケルトン（Suspenseフォールバック用）
import { TimelineSkeleton } from '@/components/feed/TimelineSkeleton'

// 投稿作成ボタン（即座に表示）
import { ComposeButton } from '@/components/feed/ComposeButton'

// Server Actions
import { getGenres } from '@/lib/actions/post'
import { getTimeline } from '@/lib/actions/feed'
import { getDraftCount } from '@/lib/actions/draft'
import { getBonsais } from '@/lib/actions/bonsai'

// 会員プラン別の制限値取得関数
import { getMembershipLimits } from '@/lib/premium'

/**
 * ページメタデータ
 */
export const metadata = {
  title: 'タイムライン - BON-LOG',
}

/**
 * タイムラインセクション（Suspense内で使用）
 *
 * タイムラインデータを取得して表示するServer Component。
 * Suspense境界内で使用され、データ取得が完了するまで
 * フォールバックUI（スケルトン）が表示されます。
 */
async function TimelineSection({ currentUserId }: { currentUserId?: string }) {
  // タイムラインデータを取得（この非同期処理がSuspenseでストリーミング）
  const timelineResult = await getTimeline()
  const posts = timelineResult.posts || []

  return <Timeline initialPosts={posts} currentUserId={currentUserId} />
}

/**
 * タイムラインページコンポーネント
 *
 * メインタイムラインを表示するServer Componentです。
 * Suspenseを使用して、投稿ボタンを即座に表示しながら
 * タイムラインをストリーミングで読み込みます。
 *
 * ## データ取得の分離
 * - 即時取得: ジャンル、制限値、下書き数、盆栽一覧（投稿ボタン用）
 * - ストリーミング: タイムライン投稿（Suspense内）
 *
 * @returns タイムラインページのJSX要素
 */
export default async function FeedPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 投稿ボタンに必要なデータを並列取得（比較的高速）
  // - ジャンルは1時間キャッシュされているため高速
  // - 制限値、下書き数、盆栽一覧は軽量クエリ
  const [genresResult, limits, draftCount, bonsaisResult] = await Promise.all([
    getGenres(),
    session?.user?.id
      ? getMembershipLimits(session.user.id)
      : Promise.resolve({
          maxPostLength: 500,
          maxImages: 4,
          maxVideos: 1,
          canSchedulePost: false,
          canViewAnalytics: false,
        }),
    getDraftCount(),
    session?.user?.id ? getBonsais() : Promise.resolve({ bonsais: [] }),
  ])

  const genres = genresResult.genres || {}
  const bonsais = bonsaisResult.bonsais || []

  return (
    <div className="relative min-h-screen">
      {/* タイムラインセクション */}
      <div>
        <h2 className="text-lg font-bold mb-4">タイムライン</h2>

        {/* Suspense境界: タイムラインをストリーミングで読み込み */}
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection currentUserId={session?.user?.id} />
        </Suspense>
      </div>

      {/* 投稿作成ボタン（即座に表示） */}
      <ComposeButton
        genres={genres}
        limits={limits}
        draftCount={draftCount}
        bonsais={bonsais}
      />
    </div>
  )
}

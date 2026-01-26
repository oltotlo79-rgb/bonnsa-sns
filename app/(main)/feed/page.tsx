/**
 * @file タイムラインページ
 * @description ユーザーのメインタイムライン（フィード）を表示するページ
 *
 * このファイルはBON-LOGのメインコンテンツであるタイムラインページを定義します。
 * フォロー中のユーザーの投稿や自分の投稿を時系列で表示し、
 * 新規投稿の作成機能も提供します。
 *
 * @features
 * - タイムライン表示（フォロー中ユーザーの投稿）
 * - 新規投稿フォーム
 * - 無限スクロール対応
 * - プレミアム会員向け機能の制限表示
 * - 下書き投稿数の表示
 */

// NextAuth.jsの認証ヘルパー関数
// 現在ログイン中のユーザー情報取得に使用
import { auth } from '@/lib/auth'

// タイムラインと投稿フォームを統合したコンポーネント
// 投稿作成とタイムライン表示を1つのUIにまとめている
import { FeedWithCompose } from '@/components/feed/FeedWithCompose'

// ジャンル一覧取得のServer Action
// 投稿フォームでのジャンル選択に使用
import { getGenres } from '@/lib/actions/post'

// タイムラインデータ取得のServer Action
// フォロー中ユーザーの投稿を取得
import { getTimeline } from '@/lib/actions/feed'

// 会員プラン別の制限値取得関数
// 投稿文字数、画像枚数などの上限を取得
import { getMembershipLimits } from '@/lib/premium'

// 下書き投稿数取得のServer Action
// 保存中の下書き数を表示するために使用
import { getDraftCount } from '@/lib/actions/draft'

// ユーザーの盆栽一覧取得のServer Action
// 投稿時の盆栽タグ付けに使用
import { getBonsais } from '@/lib/actions/bonsai'

/**
 * ページメタデータ
 * SEOおよびブラウザタブのタイトル設定
 */
export const metadata = {
  title: 'タイムライン - BON-LOG',
}

/**
 * タイムラインページコンポーネント
 *
 * メインタイムラインを表示するServer Componentです。
 * 複数のデータ取得を並列実行（Promise.all）してパフォーマンスを最適化しています。
 *
 * 取得データ:
 * - genres: 投稿に付けられるジャンル一覧
 * - posts: タイムラインの投稿データ
 * - limits: ユーザーの会員プランに応じた制限値
 * - draftCount: 保存中の下書き数
 * - bonsais: ユーザーが登録した盆栽一覧
 *
 * @returns タイムラインページのJSX要素
 */
export default async function FeedPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 複数のデータ取得を並列実行してパフォーマンスを向上
  // Promise.allにより、全てのリクエストが完了するまで待機
  const [genresResult, timelineResult, limits, draftCount, bonsaisResult] = await Promise.all([
    // ジャンル一覧を取得（松柏類、雑木類、用品・道具など）
    getGenres(),
    // タイムラインの投稿を取得
    getTimeline(),
    // 会員プランに応じた制限値を取得（未ログイン時はデフォルト値）
    session?.user?.id ? getMembershipLimits(session.user.id) : Promise.resolve({ maxPostLength: 500, maxImages: 4, maxVideos: 1, canSchedulePost: false, canViewAnalytics: false }),
    // 下書き投稿数を取得
    getDraftCount(),
    // ユーザーの盆栽一覧を取得（未ログイン時は空配列）
    session?.user?.id ? getBonsais() : Promise.resolve({ bonsais: [] }),
  ])

  // 取得結果からデータを抽出（エラー時のフォールバック付き）
  const genres = genresResult.genres || {}
  const posts = timelineResult.posts || []
  const bonsais = bonsaisResult.bonsais || []

  return (
    <FeedWithCompose
      initialPosts={posts}           // 初期表示用の投稿データ
      currentUserId={session?.user?.id}  // 現在のユーザーID（いいね等の状態管理に使用）
      genres={genres}                // ジャンル選択用データ
      limits={limits}                // 会員プラン別の制限値
      draftCount={draftCount}        // 下書き数表示用
      bonsais={bonsais}              // 盆栽タグ付け用データ
    />
  )
}

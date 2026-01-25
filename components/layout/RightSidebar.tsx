/**
 * 右サイドバーコンポーネント
 *
 * このファイルは、デスクトップ画面（xl以上）で表示される
 * 画面右側のサイドバーを提供します。
 *
 * ## 機能概要
 * - おすすめユーザーの表示（フォロワー数順）
 * - トレンドジャンルの表示（投稿数順）
 * - 広告スペースの表示
 * - フッターリンク（利用規約、プライバシー等）
 *
 * ## レスポンシブ対応
 * - xl未満: 非表示
 * - xl以上: 固定幅（320px）で表示
 *
 * ## データ取得
 * Server Componentとして動作し、サーバーサイドで
 * おすすめユーザーとトレンドジャンルを並列取得
 *
 * ## 使用例
 * ```tsx
 * // layout.tsx内で使用
 * <div className="flex">
 *   <main>{children}</main>
 *   <RightSidebar />
 * </div>
 * ```
 *
 * @module components/layout/RightSidebar
 */

// ============================================================
// インポート
// ============================================================

/**
 * Next.js リンクコンポーネント
 * クライアントサイドナビゲーションを提供
 */
import Link from 'next/link'

/**
 * Next.js 画像最適化コンポーネント
 * ユーザーアバターの表示に使用
 */
import Image from 'next/image'

/**
 * Server Actions: データ取得関数
 * - getRecommendedUsers: おすすめユーザーを取得
 * - getTrendingGenres: トレンドジャンルを取得
 */
import { getRecommendedUsers, getTrendingGenres } from '@/lib/actions/feed'

/**
 * サイドバー広告コンポーネント
 * Google AdSenseの広告を表示
 */
import { SidebarAd } from '@/components/ads'

// ============================================================
// アイコンコンポーネント
// ============================================================

/**
 * トレンドアイコン
 *
 * トレンドジャンルセクションのヘッダーに使用する
 * 上昇矢印付きの折れ線グラフアイコン
 *
 * @param className - SVG要素に適用するCSSクラス
 */
function TrendingIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 折れ線グラフ本体 */}
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      {/* 右上の矢印部分 */}
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 右サイドバーコンポーネント（Server Component）
 *
 * デスクトップ画面で表示される固定サイドバー。
 * おすすめユーザー、トレンドジャンル、広告、フッターを含む。
 *
 * ## データ取得
 * Promise.allで並列にデータを取得し、パフォーマンスを最適化
 *
 * ## スタイリング
 * - sticky positioning: スクロール時も画面に追従
 * - h-screen: 画面の高さいっぱいに表示
 * - overflow-y-auto: コンテンツが多い場合はスクロール可能
 * - shadow-washi: 和紙風のシャドウ効果
 *
 * ## 表示条件
 * - xl未満: hidden（非表示）
 * - xl以上: flex（表示）
 */
export async function RightSidebar() {
  // ============================================================
  // データ取得
  // ============================================================

  /**
   * おすすめユーザーとトレンドジャンルを並列で取得
   * Promise.allを使用することでデータ取得時間を短縮
   */
  const [usersResult, genresResult] = await Promise.all([
    getRecommendedUsers(5),  // 上位5名のおすすめユーザー
    getTrendingGenres(5),    // 上位5件のトレンドジャンル
  ])

  // 取得結果から配列を抽出（undefinedの場合は空配列）
  const recommendedUsers = usersResult.users || []
  const trendingGenres = genresResult.genres || []

  // ============================================================
  // レンダリング
  // ============================================================

  return (
    // サイドバーコンテナ: xl以上で表示、スクロール可能
    <aside className="sticky top-0 h-screen w-80 border-l bg-card/95 backdrop-blur-sm hidden xl:flex flex-col p-4 overflow-y-auto shadow-washi">

      {/* ============================================================ */}
      {/* おすすめユーザーセクション */}
      {/* ============================================================ */}
      <div className="card-washi rounded p-4 mb-4">
        {/* セクションヘッダー: 縦線アクセント付き */}
        <h3 className="font-medium mb-4 text-sm flex items-center gap-2">
          <span className="w-1 h-4 bg-primary rounded-full" />
          おすすめユーザー
        </h3>

        {/* ユーザーリスト: 存在する場合のみ表示 */}
        {recommendedUsers.length > 0 ? (
          <ul className="space-y-3">
            {recommendedUsers.map((user: typeof recommendedUsers[number]) => (
              <li key={user.id}>
                {/* ユーザーリンク: プロフィールページへ遷移 */}
                <Link
                  href={`/users/${user.id}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded p-2 -m-2 transition-all duration-200"
                >
                  {/* アバター画像またはプレースホルダー */}
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.nickname}
                      width={40}
                      height={40}
                      className="rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    // アバター未設定時: ニックネームの頭文字を表示
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center ring-2 ring-border">
                      <span className="text-muted-foreground text-sm font-medium">
                        {user.nickname.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* ユーザー情報: ニックネームとフォロワー数 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.followersCount}フォロワー
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          // ユーザーが存在しない場合のフォールバック
          <p className="text-sm text-muted-foreground">
            おすすめユーザーはいません
          </p>
        )}

        {/* ユーザー検索ページへのリンク */}
        <Link
          href="/search?tab=users"
          className="block text-sm text-primary hover:text-primary/80 mt-4 transition-colors"
        >
          もっと見る →
        </Link>
      </div>

      {/* ============================================================ */}
      {/* トレンドジャンルセクション */}
      {/* ============================================================ */}
      <div className="card-washi rounded p-4">
        {/* セクションヘッダー: トレンドアイコン付き */}
        <h3 className="font-medium mb-4 text-sm flex items-center gap-2">
          <TrendingIcon className="w-4 h-4 text-accent" />
          トレンドジャンル
        </h3>

        {/* ジャンルリスト: 存在する場合のみ表示 */}
        {trendingGenres.length > 0 ? (
          <ul className="space-y-2">
            {trendingGenres.map((genre: typeof trendingGenres[number], index: number) => (
              <li key={genre.id}>
                {/* ジャンルリンク: 検索結果ページへ遷移 */}
                <Link
                  href={`/search?genre=${genre.id}`}
                  className="flex items-center gap-3 hover:bg-muted/50 rounded p-2 -m-2 transition-all duration-200"
                >
                  {/* 順位バッジ: 1から始まる番号 */}
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  {/* ジャンル情報: 名前と投稿数 */}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{genre.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {genre.postCount}件の投稿
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          // トレンドデータが存在しない場合のフォールバック
          <p className="text-sm text-muted-foreground">
            トレンドデータはありません
          </p>
        )}
      </div>

      {/* ============================================================ */}
      {/* 広告スペース */}
      {/* ============================================================ */}
      <div className="mt-4">
        {/* Google AdSense広告: 環境変数から広告スロットIDを取得 */}
        <SidebarAd adSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR} />
      </div>

      {/* ============================================================ */}
      {/* フッター */}
      {/* ============================================================ */}
      <div className="mt-auto pt-6 text-xs text-muted-foreground">
        {/* 区切り線: グラデーションで両端がフェードアウト */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-4" />

        {/* 法的リンク: 利用規約、プライバシー、特商法表記、ヘルプ */}
        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className="hover:text-primary transition-colors">利用規約</Link>
          <span className="text-border">|</span>
          <Link href="/privacy" className="hover:text-primary transition-colors">プライバシー</Link>
          <span className="text-border">|</span>
          <Link href="/tokushoho" className="hover:text-primary transition-colors">特商法表記</Link>
          <span className="text-border">|</span>
          <Link href="/help" className="hover:text-primary transition-colors">ヘルプ</Link>
        </div>

        {/* コピーライト表示 */}
        <p className="mt-3 text-muted-foreground/70">&copy; 2024 BON-LOG</p>
      </div>
    </aside>
  )
}

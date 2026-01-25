/**
 * @file 投稿詳細ページ専用ローディングコンポーネント
 * @description 投稿詳細ページのデータ取得中に表示されるスケルトンUI
 *
 * このファイルはNext.js App Routerの規約に基づくローディングUIです。
 * /posts/[id]ページへのナビゲーション時やデータ取得中に自動的に表示されます。
 *
 * 投稿カードのレイアウトを模したスケルトンを表示することで、
 * ユーザーにコンテンツの読み込み中であることを視覚的に伝えます。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */

/**
 * 投稿詳細ローディングコンポーネント
 *
 * 投稿詳細ページ専用のローディング状態を表示します。
 * 実際の投稿カードと同じレイアウトを模したスケルトンUIを提供します。
 *
 * 構成:
 * - 戻るリンクのプレースホルダー
 * - アバター画像のプレースホルダー（円形）
 * - ユーザー名のプレースホルダー
 * - 投稿本文のプレースホルダー（複数行）
 *
 * animate-pulseクラスにより、要素が点滅してローディング中であることを示します。
 *
 * @returns スケルトンUIのJSX要素
 */
export default function PostLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* 投稿カードのスケルトン */}
      <div className="bg-card rounded-lg border overflow-hidden animate-pulse">
        {/* 戻るリンクのプレースホルダー */}
        <div className="px-4 py-3 border-b">
          <div className="h-4 bg-muted rounded w-32" />
        </div>

        {/* 投稿本体のスケルトン */}
        <div className="p-4">
          <div className="flex gap-3">
            {/* アバター画像のプレースホルダー（円形） */}
            <div className="w-10 h-10 rounded-full bg-muted" />

            {/* コンテンツエリアのプレースホルダー */}
            <div className="flex-1 space-y-2">
              {/* ユーザー名のプレースホルダー */}
              <div className="h-4 bg-muted rounded w-24" />
              {/* 投稿本文1行目のプレースホルダー */}
              <div className="h-4 bg-muted rounded w-full" />
              {/* 投稿本文2行目のプレースホルダー（短め） */}
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

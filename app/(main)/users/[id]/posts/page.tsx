/**
 * @fileoverview ユーザーの投稿一覧ページ
 *
 * このファイルは特定のユーザーが作成した全ての投稿を一覧表示するページコンポーネントです。
 * プロフィールページから「投稿」タブを選択した際に表示されます。
 *
 * 主な機能:
 * - ユーザーの全投稿を新しい順に表示
 * - プロフィールページへの戻りリンク
 * - 投稿がない場合の空状態メッセージ表示
 * - SEO用のメタデータ生成
 *
 * @route /users/[id]/posts
 * @param {string} id - 表示対象ユーザーのID
 */

// Next.jsのナビゲーションユーティリティ（404ページへのリダイレクト用）
import { notFound } from 'next/navigation'

// Prismaデータベースクライアント（投稿データ取得用）
import { prisma } from '@/lib/db'

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'

/**
 * ページコンポーネントのProps型定義
 * Next.js 15以降ではparamsがPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * ページのメタデータを動的に生成する関数
 *
 * ユーザー名を含むページタイトルを生成します。
 *
 * @param {Props} props - ページのプロパティ（ユーザーID含む）
 * @returns {Promise<Object>} メタデータオブジェクト
 */
export async function generateMetadata({ params }: Props) {
  // パラメータからユーザーIDを取得
  const { id } = await params

  // ユーザーのニックネームを取得（メタデータ用）
  const user = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true },
  })

  // ユーザーの存在有無に応じてタイトルを設定
  return {
    title: user ? `${user.nickname}の投稿 - BON-LOG` : 'ユーザーが見つかりません',
  }
}

/**
 * ユーザー投稿一覧ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. ユーザーの存在確認
 * 2. ユーザーの全投稿を新しい順で取得
 * 3. 投稿一覧またはの空状態メッセージを表示
 *
 * @param {Props} props - ページのプロパティ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function UserPostsPage({ params }: Props) {
  // URLパラメータからユーザーIDを取得
  const { id } = await params

  // ユーザーの基本情報を取得（存在確認とニックネーム表示用）
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true },
  })

  // ユーザーが存在しない場合は404ページを表示
  if (!user) {
    notFound()
  }

  // ユーザーの全投稿を新しい順で取得
  const posts = await prisma.post.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
  })

  // 投稿一覧ページのUIをレンダリング
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダーセクション */}
        <div className="px-4 py-3 border-b">
          {/* プロフィールページへの戻りリンク */}
          <Link href={`/users/${id}`} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">投稿</h1>
        </div>

        {/* 投稿一覧または空メッセージ */}
        {posts && posts.length > 0 ? (
          <div className="divide-y">
            {/* 各投稿をシンプルなカード形式で表示 */}
            {posts.map((post: typeof posts[number]) => (
              <div key={post.id} className="p-4">
                {/* 投稿本文（改行を保持して表示） */}
                <p className="whitespace-pre-wrap">{post.content}</p>
                {/* 投稿日時（日本語形式） */}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          // 投稿がない場合の空状態メッセージ
          <p className="p-8 text-center text-muted-foreground">
            まだ投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}

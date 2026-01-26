/**
 * @file app/(public)/about/page.tsx
 * @description BON-LOGサービス紹介ページ
 *
 * このページはBON-LOGサービスの概要、ミッション、特徴を紹介します。
 * Google AdSense審査において必須となるページです。
 *
 * 主な内容:
 * - サービス概要
 * - ミッション・ビジョン
 * - 主な機能紹介
 * - 運営者情報
 */

import { Metadata } from 'next'
import Link from 'next/link'

/**
 * ページメタデータの定義
 */
export const metadata: Metadata = {
  title: 'BON-LOGについて - BON-LOG',
  description: 'BON-LOG（ボンログ）は盆栽愛好家のためのSNSプラットフォームです。盆栽の魅力を共有し、愛好家同士のコミュニティを形成することを目指しています。',
}

/**
 * 機能カードコンポーネント
 */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

/**
 * Aboutページコンポーネント
 */
export default function AboutPage() {
  return (
    <div className="space-y-12">
      {/* ヒーローセクション */}
      <section className="text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">BON-LOGについて</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          盆栽愛好家のためのコミュニティプラットフォーム
        </p>
      </section>

      {/* サービス概要 */}
      <section className="rounded-lg border bg-card p-8">
        <h2 className="mb-4 text-2xl font-bold">サービス概要</h2>
        <p className="mb-4 text-muted-foreground leading-relaxed">
          BON-LOG（ボンログ）は、盆栽を愛するすべての人々のために作られたSNSプラットフォームです。
          初心者から熟練者まで、盆栽に関する知識や経験を共有し、
          日本の伝統文化である盆栽の魅力を広めることを目的としています。
        </p>
        <p className="text-muted-foreground leading-relaxed">
          2026年にサービスを開始し、盆栽愛好家同士の交流の場として、
          また盆栽に関する情報を発信・収集できるプラットフォームとして成長を続けています。
        </p>
      </section>

      {/* ミッション */}
      <section>
        <h2 className="mb-6 text-2xl font-bold text-center">私たちのミッション</h2>
        <div className="rounded-lg bg-primary/5 p-8 text-center">
          <p className="text-xl font-medium leading-relaxed">
            「盆栽の魅力を、もっと多くの人へ」
          </p>
          <p className="mt-4 text-muted-foreground">
            日本の伝統文化である盆栽を、デジタルの力で次世代へ繋ぎ、
            世界中の愛好家が集えるコミュニティを創造します。
          </p>
        </div>
      </section>

      {/* 主な機能 */}
      <section>
        <h2 className="mb-6 text-2xl font-bold text-center">主な機能</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }
            title="投稿・共有"
            description="盆栽の写真や動画を投稿し、育成記録や日々の様子を共有できます。ジャンル別に整理することで、見たい投稿を簡単に見つけられます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
            title="コミュニティ"
            description="フォロー機能やコメント機能で、他の愛好家と繋がりましょう。いいねやブックマークで気になる投稿を保存できます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            }
            title="盆栽園マップ"
            description="全国の盆栽園を地図から探せます。口コミやレビューを参考に、訪問先を計画しましょう。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            }
            title="イベント情報"
            description="盆栽展示会や即売会などのイベント情報を掲載。地域や日程で絞り込んで、参加したいイベントを見つけられます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
            title="プレミアム会員"
            description="広告非表示、予約投稿、投稿分析など、より便利な機能をご利用いただけます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            }
            title="検索機能"
            description="キーワードやハッシュタグで投稿を検索。ユーザーや盆栽園も簡単に見つけられます。"
          />
        </div>
      </section>

      {/* 運営情報 */}
      <section className="rounded-lg border bg-card p-8">
        <h2 className="mb-4 text-2xl font-bold">運営情報</h2>
        <dl className="space-y-4">
          <div>
            <dt className="font-medium">サービス名</dt>
            <dd className="text-muted-foreground">BON-LOG（ボンログ）</dd>
          </div>
          <div>
            <dt className="font-medium">運営</dt>
            <dd className="text-muted-foreground">BON-LOG運営</dd>
          </div>
          <div>
            <dt className="font-medium">サービス開始</dt>
            <dd className="text-muted-foreground">2026年</dd>
          </div>
          <div>
            <dt className="font-medium">お問い合わせ</dt>
            <dd>
              <Link href="/contact" className="text-primary hover:underline">
                お問い合わせフォーム
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="mb-4 text-2xl font-bold">BON-LOGを始めましょう</h2>
        <p className="mb-6 text-muted-foreground">
          あなたの盆栽ライフをより豊かにするために、今すぐ無料で登録
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            無料で始める
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            ヘルプを見る
          </Link>
        </div>
      </section>
    </div>
  )
}

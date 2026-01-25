/**
 * @file EventCalendarWrapper.tsx
 * @description イベントカレンダーラッパーコンポーネント
 *
 * 目的:
 * - EventCalendarコンポーネントを動的インポートでラップする
 * - サーバーサイドレンダリング（SSR）を無効化してクライアントサイドのみでレンダリングする
 * - ローディング中のスケルトン表示を提供する
 *
 * 機能概要:
 * - next/dynamicを使用した遅延読み込み
 * - SSR無効化（ssr: false）によるハイドレーションエラーの防止
 * - ローディング中のアニメーション付きプレースホルダー表示
 *
 * 使用背景:
 * EventCalendarコンポーネントは日付操作やDOM操作を多用するため、
 * サーバーサイドでレンダリングするとハイドレーションの不一致が
 * 発生する可能性がある。このラッパーを使用することで、
 * カレンダーはクライアントサイドでのみレンダリングされる。
 *
 * 使用例:
 * ```tsx
 * // Server Componentから使用可能
 * export default async function EventsPage() {
 *   const events = await getEvents();
 *   return <EventCalendarWrapper events={events} />;
 * }
 * ```
 */

// Client Componentとして宣言（動的インポートを使用するため）
'use client'

// Next.jsの動的インポート機能 - コンポーネントの遅延読み込みに使用
import dynamic from 'next/dynamic'

/**
 * イベントデータの型定義
 * EventCalendarに渡すイベント情報の構造を定義
 */
interface Event {
  /** イベントの一意識別子 */
  id: string
  /** イベントのタイトル */
  title: string
  /** イベント開始日時 */
  startDate: Date
  /** イベント終了日時（単日イベントの場合はnull） */
  endDate: Date | null
  /** 開催都道府県（カレンダー表示では使用しないがデータ型を統一） */
  prefecture: string | null
}

/**
 * EventCalendarWrapperコンポーネントのプロパティ型定義
 */
interface EventCalendarWrapperProps {
  /** 表示するイベントの配列 */
  events: Event[]
}

/**
 * EventCalendarの動的インポート設定
 *
 * - ssr: false - サーバーサイドレンダリングを無効化
 *   これにより、カレンダーはクライアントサイドでのみレンダリングされる
 *
 * - loading - コンポーネント読み込み中に表示されるフォールバックUI
 *   アニメーション付きのスケルトン表示でユーザー体験を向上
 */
const EventCalendar = dynamic(
  // インポートするモジュールを指定
  // named exportの場合は.then()で特定のエクスポートを取得
  () => import('./EventCalendar').then((mod) => mod.EventCalendar),
  {
    // サーバーサイドレンダリングを無効化
    ssr: false,
    // ローディング中に表示するコンポーネント
    loading: () => (
      <div className="bg-card rounded-lg border p-4">
        {/* スケルトンローディング表示 */}
        {/* 実際のカレンダーと同程度の高さを確保してレイアウトシフトを防止 */}
        <div className="h-[500px] bg-muted animate-pulse rounded-lg" />
      </div>
    ),
  }
)

/**
 * イベントカレンダーラッパーコンポーネント
 * EventCalendarを動的インポートでラップし、SSRを無効化する
 *
 * @param props - コンポーネントのプロパティ
 * @param props.events - 表示するイベントの配列
 * @returns 動的にインポートされたEventCalendarコンポーネント
 */
export function EventCalendarWrapper({ events }: EventCalendarWrapperProps) {
  // 動的インポートされたEventCalendarにpropsを渡して表示
  return <EventCalendar events={events} />
}

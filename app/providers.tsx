/**
 * @file app/providers.tsx
 * @description アプリケーション共通プロバイダーコンポーネント
 *
 * このファイルはアプリケーション全体で使用する各種プロバイダーを
 * まとめてラップするコンポーネントを定義します。
 *
 * 含まれるプロバイダー:
 * - React Query (TanStack Query): サーバー状態管理
 * - ThemeProvider: ダーク/ライトモード切り替え
 *
 * 注意:
 * - 'use client'ディレクティブが必要（useState, useEffectを使用するため）
 * - ルートレイアウト（app/layout.tsx）から呼び出される
 * - Sentryクライアント初期化も行う（エラー監視用）
 */

// Client Componentとして動作することを宣言
// プロバイダーはReact Hooksを使用するためClient Componentである必要がある
'use client'

// React Query (TanStack Query) のクライアントとプロバイダー
// QueryClient: キャッシュとクエリ状態を管理するクライアント
// QueryClientProvider: QueryClientをコンポーネントツリーに提供するプロバイダー
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// React Hook: 状態管理
import { useState } from 'react'
// テーマプロバイダー: ダーク/ライトモードの切り替えを管理
import { ThemeProvider } from '@/components/theme/ThemeProvider'

// Sentryクライアント初期化
// 本番環境でJavaScriptエラーを監視・報告するためのサービス
import '../sentry.client.config'

/**
 * アプリケーション共通プロバイダーコンポーネント
 *
 * 各種プロバイダーを階層的にネストして、アプリケーション全体に
 * 必要なコンテキストを提供します。
 *
 * プロバイダーの階層構造:
 * 1. QueryClientProvider: サーバー状態管理（最外層）
 * 2. ThemeProvider: テーマ管理（内層）
 *
 * @param children - ラップする子コンポーネント
 * @returns プロバイダーでラップされたコンポーネントツリー
 */
export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * QueryClientの状態管理
   *
   * useStateのイニシャライザ関数を使用して、QueryClientを一度だけ作成
   * これにより、コンポーネントの再レンダリング時に新しいQueryClientが
   * 作成されることを防ぐ
   *
   * defaultOptions:
   * - staleTime: データが「古い」とみなされるまでの時間（1分）
   *   この間は再フェッチを行わずキャッシュを使用
   * - refetchOnWindowFocus: ウィンドウフォーカス時の自動再フェッチを無効化
   *   SNSアプリでは頻繁なタブ切り替えがあるため、不要な再フェッチを防止
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1分間はデータを新鮮とみなす
            refetchOnWindowFocus: false, // ウィンドウフォーカスでの再フェッチを無効化
          },
        },
      })
  )

  return (
    // QueryClientProviderでReact Queryの機能を提供
    <QueryClientProvider client={queryClient}>
      {/* ThemeProviderでダーク/ライトモードの切り替え機能を提供 */}
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

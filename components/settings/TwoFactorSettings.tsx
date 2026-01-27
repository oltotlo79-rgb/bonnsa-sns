/**
 * 2段階認証設定コンポーネント
 *
 * 2段階認証（2FA）のセットアップ、有効化/無効化、
 * バックアップコードの管理UIを提供します。
 *
 * ## 機能概要
 * - 2FAの有効/無効状態表示
 * - QRコードによるセットアップ
 * - バックアップコードの表示
 * - 2FAの無効化
 * - バックアップコードの再生成
 *
 * @module components/settings/TwoFactorSettings
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  setup2FA,
  enable2FA,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
} from '@/lib/actions/two-factor'

// ============================================================
// アイコンコンポーネント
// ============================================================

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ShieldOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m2 2 20 20" />
      <path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71" />
      <path d="M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

// ============================================================
// 型定義
// ============================================================

type SetupState = 'idle' | 'setup' | 'verify' | 'success'

// ============================================================
// メインコンポーネント
// ============================================================

/**
 * 2段階認証設定コンポーネント
 */
export function TwoFactorSettings() {
  // ステート
  const [isEnabled, setIsEnabled] = useState(false)
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // セットアップ関連のステート
  const [setupState, setSetupState] = useState<SetupState>('idle')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)

  // 無効化関連のステート
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisablePassword, setShowDisablePassword] = useState(false)
  const [disableLoading, setDisableLoading] = useState(false)

  // バックアップコード再生成関連のステート
  const [showRegenerateForm, setShowRegenerateForm] = useState(false)
  const [regeneratePassword, setRegeneratePassword] = useState('')
  const [showRegeneratePassword, setShowRegeneratePassword] = useState(false)
  const [regenerateLoading, setRegenerateLoading] = useState(false)
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([])

  // コピー状態
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // 初期状態の取得
  useEffect(() => {
    async function fetchStatus() {
      const result = await get2FAStatus()
      if ('error' in result) {
        setError(result.error)
      } else if (result.enabled) {
        setIsEnabled(true)
        setBackupCodesRemaining(result.backupCodesRemaining)
      }
      setLoading(false)
    }
    fetchStatus()
  }, [])

  // セットアップを開始
  const handleStartSetup = async () => {
    setError(null)
    setSetupState('setup')

    const result = await setup2FA()
    if ('error' in result) {
      setError(result.error)
      setSetupState('idle')
      return
    }

    setQrCode(result.qrCode)
    setSecret(result.secret)
    setBackupCodes(result.backupCodes)
    setSetupState('verify')
  }

  // 2FAを有効化
  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secret || backupCodes.length === 0) return

    setVerifyLoading(true)
    setError(null)

    const result = await enable2FA(verifyCode, secret, backupCodes)
    if ('error' in result) {
      setError(result.error)
      setVerifyLoading(false)
      return
    }

    setIsEnabled(true)
    setBackupCodesRemaining(backupCodes.length)
    setSetupState('success')
    setVerifyLoading(false)
    setSuccessMessage('2段階認証が有効になりました')
  }

  // 2FAを無効化
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setDisableLoading(true)
    setError(null)

    const result = await disable2FA(disablePassword)
    if ('error' in result) {
      setError(result.error)
      setDisableLoading(false)
      return
    }

    setIsEnabled(false)
    setShowDisableForm(false)
    setDisablePassword('')
    setDisableLoading(false)
    setSuccessMessage('2段階認証が無効になりました')
  }

  // バックアップコードを再生成
  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegenerateLoading(true)
    setError(null)

    const result = await regenerateBackupCodes(regeneratePassword)
    if ('error' in result) {
      setError(result.error)
      setRegenerateLoading(false)
      return
    }

    setNewBackupCodes(result.backupCodes)
    setBackupCodesRemaining(result.backupCodes.length)
    setShowRegenerateForm(false)
    setRegeneratePassword('')
    setRegenerateLoading(false)
    setSuccessMessage('バックアップコードが再生成されました')
  }

  // コードをコピー
  const handleCopyCode = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // 全コードをコピー
  const handleCopyAllCodes = async (codes: string[]) => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopiedIndex(-1)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // セットアップをキャンセル
  const handleCancelSetup = () => {
    setSetupState('idle')
    setQrCode(null)
    setSecret(null)
    setBackupCodes([])
    setVerifyCode('')
    setError(null)
  }

  // 成功メッセージの消去
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-4" />
        <div className="h-20 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* エラー/成功メッセージ */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-green-500/10 text-green-600 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* 2FA無効状態 */}
      {!isEnabled && setupState === 'idle' && (
        <div className="border rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <ShieldOffIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">2段階認証</h3>
              <p className="text-sm text-muted-foreground mt-1">
                2段階認証を有効にすると、ログイン時にパスワードに加えて認証アプリからのコードが必要になります。
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Google Authenticator、Microsoft Authenticatorなどの認証アプリをご利用ください。
              </p>
              <Button onClick={handleStartSetup} className="mt-4">
                2段階認証を設定する
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* セットアップ: QRコード表示 */}
      {setupState === 'verify' && qrCode && (
        <div className="border rounded-lg p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-2">ステップ 1: 認証アプリでスキャン</h3>
            <p className="text-sm text-muted-foreground mb-4">
              認証アプリ（Google Authenticator等）で下のQRコードをスキャンしてください。
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="2FA QRコード" className="w-48 h-48" />
            </div>
            {secret && (
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">QRコードを読み取れない場合は、以下のコードを手動で入力してください:</p>
                <code className="text-sm bg-muted px-2 py-1 rounded mt-1 inline-block">{secret}</code>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">ステップ 2: バックアップコードを保存</h3>
            <p className="text-sm text-muted-foreground mb-4">
              以下のバックアップコードを安全な場所に保存してください。認証アプリにアクセスできなくなった場合に使用できます。
            </p>
            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between bg-background p-2 rounded">
                    <code className="text-sm font-mono">{code}</code>
                    <button
                      onClick={() => handleCopyCode(code, index)}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      {copiedIndex === index ? (
                        <CheckIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <CopyIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyAllCodes(backupCodes)}
                className="mt-3 w-full"
              >
                {copiedIndex === -1 ? 'コピーしました！' : '全てコピー'}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">ステップ 3: 認証コードを入力</h3>
            <p className="text-sm text-muted-foreground mb-4">
              認証アプリに表示されている6桁のコードを入力してください。
            </p>
            <form onSubmit={handleEnable} className="space-y-4">
              <div>
                <Label htmlFor="verify-code">認証コード</Label>
                <Input
                  id="verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={verifyCode.length !== 6 || verifyLoading}>
                  {verifyLoading ? '確認中...' : '2段階認証を有効化'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelSetup}>
                  キャンセル
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* セットアップ完了 */}
      {setupState === 'success' && (
        <div className="border rounded-lg p-6 border-green-500/50 bg-green-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-700">2段階認証が有効になりました</h3>
              <p className="text-sm text-muted-foreground mt-1">
                次回ログイン時から、認証アプリのコードが必要になります。
              </p>
              <Button
                variant="outline"
                onClick={() => setSetupState('idle')}
                className="mt-4"
              >
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA有効状態 */}
      {isEnabled && setupState === 'idle' && (
        <>
          <div className="border rounded-lg p-6 border-green-500/50 bg-green-500/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheckIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-700">2段階認証が有効です</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  残りのバックアップコード: {backupCodesRemaining}個
                </p>
                {backupCodesRemaining < 3 && (
                  <p className="text-sm text-yellow-600 mt-1">
                    バックアップコードが少なくなっています。新しいコードを生成することをおすすめします。
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 新しいバックアップコード表示 */}
          {newBackupCodes.length > 0 && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">新しいバックアップコード</h3>
              <p className="text-sm text-muted-foreground mb-4">
                以下のバックアップコードを安全な場所に保存してください。古いコードは無効になりました。
              </p>
              <div className="bg-muted rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  {newBackupCodes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between bg-background p-2 rounded">
                      <code className="text-sm font-mono">{code}</code>
                      <button
                        onClick={() => handleCopyCode(code, index)}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        {copiedIndex === index ? (
                          <CheckIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <CopyIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyAllCodes(newBackupCodes)}
                  className="mt-3 w-full"
                >
                  {copiedIndex === -1 ? 'コピーしました！' : '全てコピー'}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setNewBackupCodes([])}
                className="mt-4"
              >
                閉じる
              </Button>
            </div>
          )}

          {/* バックアップコード再生成 */}
          {!showDisableForm && !showRegenerateForm && newBackupCodes.length === 0 && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">バックアップコード</h3>
              <p className="text-sm text-muted-foreground mb-4">
                バックアップコードを紛失した場合、新しいコードを生成できます。古いコードは無効になります。
              </p>
              <Button variant="outline" onClick={() => setShowRegenerateForm(true)}>
                バックアップコードを再生成
              </Button>
            </div>
          )}

          {/* バックアップコード再生成フォーム */}
          {showRegenerateForm && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">バックアップコードを再生成</h3>
              <p className="text-sm text-muted-foreground mb-4">
                パスワードを入力して、新しいバックアップコードを生成します。
              </p>
              <form onSubmit={handleRegenerate} className="space-y-4">
                <div>
                  <Label htmlFor="regenerate-password">パスワード</Label>
                  <div className="relative mt-1">
                    <Input
                      id="regenerate-password"
                      type={showRegeneratePassword ? 'text' : 'password'}
                      value={regeneratePassword}
                      onChange={(e) => setRegeneratePassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegeneratePassword(!showRegeneratePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showRegeneratePassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={!regeneratePassword || regenerateLoading}>
                    {regenerateLoading ? '生成中...' : '再生成'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowRegenerateForm(false)
                      setRegeneratePassword('')
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 2FA無効化 */}
          {!showDisableForm && !showRegenerateForm && newBackupCodes.length === 0 && (
            <div className="border rounded-lg p-6 border-destructive/30">
              <h3 className="font-semibold mb-2 text-destructive">2段階認証を無効化</h3>
              <p className="text-sm text-muted-foreground mb-4">
                2段階認証を無効にすると、アカウントのセキュリティが低下します。
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDisableForm(true)}
              >
                2段階認証を無効化
              </Button>
            </div>
          )}

          {/* 2FA無効化フォーム */}
          {showDisableForm && (
            <div className="border rounded-lg p-6 border-destructive/30">
              <h3 className="font-semibold mb-2 text-destructive">2段階認証を無効化</h3>
              <p className="text-sm text-muted-foreground mb-4">
                パスワードを入力して、2段階認証を無効にします。
              </p>
              <form onSubmit={handleDisable} className="space-y-4">
                <div>
                  <Label htmlFor="disable-password">パスワード</Label>
                  <div className="relative mt-1">
                    <Input
                      id="disable-password"
                      type={showDisablePassword ? 'text' : 'password'}
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDisablePassword(!showDisablePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showDisablePassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="destructive" disabled={!disablePassword || disableLoading}>
                    {disableLoading ? '無効化中...' : '無効化する'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDisableForm(false)
                      setDisablePassword('')
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}

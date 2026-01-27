/**
 * TwoFactorSettingsコンポーネントのテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings'

// Server Actionsモック
const mockGet2FAStatus = jest.fn()
const mockSetup2FA = jest.fn()
const mockEnable2FA = jest.fn()
const mockDisable2FA = jest.fn()
const mockRegenerateBackupCodes = jest.fn()

jest.mock('@/lib/actions/two-factor', () => ({
  get2FAStatus: () => mockGet2FAStatus(),
  setup2FA: () => mockSetup2FA(),
  enable2FA: (...args: unknown[]) => mockEnable2FA(...args),
  disable2FA: (...args: unknown[]) => mockDisable2FA(...args),
  regenerateBackupCodes: (...args: unknown[]) => mockRegenerateBackupCodes(...args),
}))

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // ローディング状態
  // ============================================================

  describe('ローディング状態', () => {
    it('ローディング中にスケルトンを表示する', () => {
      mockGet2FAStatus.mockImplementation(() => new Promise(() => {}))
      render(<TwoFactorSettings />)

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 2FA無効状態
  // ============================================================

  describe('2FA無効状態', () => {
    beforeEach(() => {
      mockGet2FAStatus.mockResolvedValue({ enabled: false })
    })

    it('2FAが無効な場合、セットアップボタンを表示する', async () => {
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })
    })

    it('説明テキストが表示される', async () => {
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText(/2段階認証を有効にすると/)).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // セットアップフロー
  // ============================================================

  describe('セットアップフロー', () => {
    beforeEach(() => {
      mockGet2FAStatus.mockResolvedValue({ enabled: false })
      mockSetup2FA.mockResolvedValue({
        qrCode: 'data:image/png;base64,test',
        secret: 'TESTSECRET123',
        backupCodes: ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8'],
      })
    })

    it('セットアップを開始するとQRコードが表示される', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByAltText('2FA QRコード')).toBeInTheDocument()
        expect(screen.getByText('TESTSECRET123')).toBeInTheDocument()
      })
    })

    it('バックアップコードが表示される', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('CODE1')).toBeInTheDocument()
        expect(screen.getByText('CODE8')).toBeInTheDocument()
      })
    })

    it('認証コード入力フィールドが表示される', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })
    })

    it('キャンセルでセットアップを中止できる', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('キャンセル')).toBeInTheDocument()
      })

      await user.click(screen.getByText('キャンセル'))

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })
    })

    it('セットアップエラー時にエラーメッセージを表示する', async () => {
      mockSetup2FA.mockResolvedValue({ error: 'セットアップに失敗しました' })
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('セットアップに失敗しました')).toBeInTheDocument()
      })
    })

    it('6桁未満の認証コードでは有効化ボタンが無効', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '12345')
      expect(screen.getByText('2段階認証を有効化')).toBeDisabled()
    })
  })

  // ============================================================
  // 2FA有効化
  // ============================================================

  describe('2FA有効化', () => {
    beforeEach(() => {
      mockGet2FAStatus.mockResolvedValue({ enabled: false })
      mockSetup2FA.mockResolvedValue({
        qrCode: 'data:image/png;base64,test',
        secret: 'TESTSECRET123',
        backupCodes: ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8'],
      })
    })

    it('正しい認証コードで2FAを有効化できる', async () => {
      mockEnable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '123456')
      await user.click(screen.getByText('2段階認証を有効化'))

      await waitFor(() => {
        // 成功メッセージが表示される（複数要素があるためAllByを使用）
        expect(screen.getAllByText('2段階認証が有効になりました').length).toBeGreaterThan(0)
      })
    })

    it('有効化エラー時にエラーメッセージを表示する', async () => {
      mockEnable2FA.mockResolvedValue({ error: '認証コードが正しくありません' })
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '123456')
      await user.click(screen.getByText('2段階認証を有効化'))

      await waitFor(() => {
        expect(screen.getByText('認証コードが正しくありません')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // 2FA有効状態
  // ============================================================

  describe('2FA有効状態', () => {
    beforeEach(() => {
      mockGet2FAStatus.mockResolvedValue({ enabled: true, backupCodesRemaining: 8 })
    })

    it('2FAが有効な場合、ステータスを表示する', async () => {
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('2段階認証が有効です')).toBeInTheDocument()
        expect(screen.getByText('残りのバックアップコード: 8個')).toBeInTheDocument()
      })
    })

    it('バックアップコードが少ない場合、警告を表示する', async () => {
      mockGet2FAStatus.mockResolvedValue({ enabled: true, backupCodesRemaining: 2 })
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText(/バックアップコードが少なくなっています/)).toBeInTheDocument()
      })
    })

    it('無効化ボタンとバックアップコード再生成ボタンを表示する', async () => {
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '2段階認証を無効化' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'バックアップコードを再生成' })).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // 2FA無効化
  // ============================================================

  describe('2FA無効化', () => {
    beforeEach(() => {
      mockGet2FAStatus.mockResolvedValue({ enabled: true, backupCodesRemaining: 8 })
    })

    it('パスワード入力フォームが表示される', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '2段階認証を無効化' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '2段階認証を無効化' }))

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
        expect(screen.getByText('無効化する')).toBeInTheDocument()
      })
    })

    it('正しいパスワードで2FAを無効化できる', async () => {
      mockDisable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '2段階認証を無効化' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '2段階認証を無効化' }))

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByText('無効化する'))

      await waitFor(() => {
        expect(screen.getByText('2段階認証が無効になりました')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // バックアップコード再生成
  // ============================================================

  describe('バックアップコード再生成', () => {
    beforeEach(() => {
      mockGet2FAStatus.mockResolvedValue({ enabled: true, backupCodesRemaining: 3 })
    })

    it('再生成フォームが表示される', async () => {
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('バックアップコードを再生成')).toBeInTheDocument()
      })

      await user.click(screen.getByText('バックアップコードを再生成'))

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
        expect(screen.getByText('再生成')).toBeInTheDocument()
      })
    })

    it('正しいパスワードでバックアップコードを再生成できる', async () => {
      mockRegenerateBackupCodes.mockResolvedValue({
        backupCodes: ['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5', 'NEW6', 'NEW7', 'NEW8'],
      })
      const user = userEvent.setup()
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('バックアップコードを再生成')).toBeInTheDocument()
      })

      await user.click(screen.getByText('バックアップコードを再生成'))

      await waitFor(() => {
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByText('再生成'))

      await waitFor(() => {
        expect(screen.getByText('バックアップコードが再生成されました')).toBeInTheDocument()
        expect(screen.getByText('NEW1')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // エラー状態
  // ============================================================

  describe('エラー状態', () => {
    it('ステータス取得エラー時にエラーメッセージを表示する', async () => {
      mockGet2FAStatus.mockResolvedValue({ error: '取得に失敗しました' })
      render(<TwoFactorSettings />)

      await waitFor(() => {
        expect(screen.getByText('取得に失敗しました')).toBeInTheDocument()
      })
    })
  })
})

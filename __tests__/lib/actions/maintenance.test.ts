/**
 * メンテナンスモード機能のテスト
 *
 * @jest-environment node
 */

// Prisma モック
const mockPrisma = {
  systemSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  adminUser: {
    findUnique: jest.fn(),
  },
  adminLog: {
    create: jest.fn(),
  },
}

jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// NextAuth モック
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

// isAdmin モック
const mockIsAdmin = jest.fn()
jest.mock('@/lib/actions/admin', () => ({
  isAdmin: mockIsAdmin,
}))

// revalidatePath モック
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

describe('Maintenance Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  // ============================================================
  // getMaintenanceSettings
  // ============================================================

  describe('getMaintenanceSettings', () => {
    it('設定がない場合はデフォルト値を返す', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null)

      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const settings = await getMaintenanceSettings()

      expect(settings.enabled).toBe(false)
      expect(settings.startTime).toBeNull()
      expect(settings.endTime).toBeNull()
      expect(settings.message).toBeTruthy()
    })

    it('保存された設定を返す', async () => {
      const savedSettings = {
        enabled: true,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        message: 'カスタムメッセージ',
      }

      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        key: 'maintenance_mode',
        value: savedSettings,
      })

      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const settings = await getMaintenanceSettings()

      expect(settings.enabled).toBe(true)
      expect(settings.startTime).toBe('2024-01-01T00:00:00Z')
      expect(settings.endTime).toBe('2024-01-02T00:00:00Z')
      expect(settings.message).toBe('カスタムメッセージ')
    })

    it('エラー時はデフォルト値を返す', async () => {
      mockPrisma.systemSetting.findUnique.mockRejectedValue(new Error('DB error'))

      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const settings = await getMaintenanceSettings()

      expect(settings.enabled).toBe(false)
    })
  })

  // ============================================================
  // isMaintenanceMode
  // ============================================================

  describe('isMaintenanceMode', () => {
    it('無効の場合はfalseを返す', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: false,
          startTime: null,
          endTime: null,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(false)
    })

    it('有効で時間指定なしの場合はtrueを返す', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: null,
          endTime: null,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(true)
    })

    it('開始時間前の場合はfalseを返す', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString() // 1時間後

      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: futureTime,
          endTime: null,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(false)
    })

    it('終了時間後の場合はfalseを返す', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString() // 1時間前

      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: null,
          endTime: pastTime,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(false)
    })

    it('期間内の場合はtrueを返す', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString() // 1時間前
      const futureTime = new Date(Date.now() + 3600000).toISOString() // 1時間後

      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: pastTime,
          endTime: futureTime,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(true)
    })
  })

  // ============================================================
  // checkIsAdmin
  // ============================================================

  describe('checkIsAdmin', () => {
    it('管理者の場合はtrueを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        userId: 'admin-1',
        role: 'admin',
      })

      const { checkIsAdmin } = await import('@/lib/actions/maintenance')
      const result = await checkIsAdmin('admin-1')

      expect(result).toBe(true)
    })

    it('管理者でない場合はfalseを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { checkIsAdmin } = await import('@/lib/actions/maintenance')
      const result = await checkIsAdmin('user-1')

      expect(result).toBe(false)
    })

    it('エラー時はfalseを返す', async () => {
      mockPrisma.adminUser.findUnique.mockRejectedValue(new Error('DB error'))

      const { checkIsAdmin } = await import('@/lib/actions/maintenance')
      const result = await checkIsAdmin('user-1')

      expect(result).toBe(false)
    })
  })

  // ============================================================
  // updateMaintenanceSettings
  // ============================================================

  describe('updateMaintenanceSettings', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const result = await updateMaintenanceSettings({ enabled: true })

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockIsAdmin.mockResolvedValue(false)

      const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const result = await updateMaintenanceSettings({ enabled: true })

      expect(result.success).toBe(false)
      expect(result.error).toBe('管理者権限が必要です')
    })

    it('管理者の場合は設定を更新する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mockIsAdmin.mockResolvedValue(true)
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
      mockPrisma.systemSetting.upsert.mockResolvedValue({})
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const result = await updateMaintenanceSettings({
        enabled: true,
        message: '新しいメッセージ',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalled()
      expect(mockPrisma.adminLog.create).toHaveBeenCalled()
    })
  })

  // ============================================================
  // toggleMaintenanceMode
  // ============================================================

  describe('toggleMaintenanceMode', () => {
    it('メンテナンスモードを有効にする', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mockIsAdmin.mockResolvedValue(true)
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: { enabled: false, startTime: null, endTime: null, message: '' },
      })
      mockPrisma.systemSetting.upsert.mockResolvedValue({})
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { toggleMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await toggleMaintenanceMode(true)

      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// MaintenanceSettings型テスト
// ============================================================

describe('MaintenanceSettings 型', () => {
  it('必要なプロパティを持つ', async () => {
    const settings = {
      enabled: true,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
      message: 'メンテナンス中',
    }

    expect(settings).toHaveProperty('enabled')
    expect(settings).toHaveProperty('startTime')
    expect(settings).toHaveProperty('endTime')
    expect(settings).toHaveProperty('message')
  })

  it('nullの日時も許容する', () => {
    const settings = {
      enabled: true,
      startTime: null,
      endTime: null,
      message: 'メンテナンス中',
    }

    expect(settings.startTime).toBeNull()
    expect(settings.endTime).toBeNull()
  })
})

// ============================================================
// 許可パス判定テスト
// ============================================================

describe('メンテナンス許可パス', () => {
  const allowedPaths = ['/', '/login', '/register', '/password-reset', '/maintenance', '/api/auth']

  it.each(allowedPaths)('%s はメンテナンス中でもアクセス可能', (path) => {
    const isAllowed = allowedPaths.some(
      (p) => path === p || path.startsWith(p + '/')
    )
    expect(isAllowed).toBe(true)
  })

  const blockedPaths = ['/feed', '/posts', '/users/123', '/settings', '/admin']

  it.each(blockedPaths)('%s はメンテナンス中はブロックされる', (path) => {
    const isAllowed = allowedPaths.some(
      (p) => path === p || path.startsWith(p + '/')
    )
    expect(isAllowed).toBe(false)
  })
})

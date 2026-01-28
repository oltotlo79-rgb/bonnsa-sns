/**
 * ブラックリスト管理Server Actionsのテスト
 */

// モック設定
const mockAuth = jest.fn()
const mockIsAdmin = jest.fn()
const mockRevalidatePath = jest.fn()

const mockPrisma = {
  emailBlacklist: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  deviceBlacklist: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  userDevice: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}

jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/actions/admin', () => ({
  isAdmin: () => mockIsAdmin(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}))

describe('Blacklist Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // デフォルトで管理者として認証
    mockAuth.mockResolvedValue({ user: { id: 'admin-123' } })
    mockIsAdmin.mockResolvedValue(true)
  })

  // ============================================================
  // addEmailToBlacklist
  // ============================================================

  describe('addEmailToBlacklist', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('無効なメールアドレスの場合はエラーを返す', async () => {
      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('invalid-email')

      expect(result).toEqual({ error: '有効なメールアドレスを入力してください' })
    })

    it('空のメールアドレスの場合はエラーを返す', async () => {
      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('')

      expect(result).toEqual({ error: '有効なメールアドレスを入力してください' })
    })

    it('既に登録されている場合はエラーを返す', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce({
        id: 'bl-1',
        email: 'test@example.com',
      })

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toEqual({ error: 'このメールアドレスは既にブラックリストに登録されています' })
    })

    it('正常に追加する', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce(null)
      mockPrisma.emailBlacklist.create.mockResolvedValueOnce({
        id: 'bl-1',
        email: 'test@example.com',
      })

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('Test@Example.com', 'スパム行為')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.emailBlacklist.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com', // 小文字に正規化
          reason: 'スパム行為',
          createdBy: 'admin-123',
        },
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/blacklist')
    })

    it('DBエラーの場合はエラーを返す', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce(null)
      mockPrisma.emailBlacklist.create.mockRejectedValueOnce(new Error('DB error'))

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toEqual({ error: 'ブラックリストへの追加に失敗しました' })
    })
  })

  // ============================================================
  // removeEmailFromBlacklist
  // ============================================================

  describe('removeEmailFromBlacklist', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('正常に削除する', async () => {
      mockPrisma.emailBlacklist.delete.mockResolvedValueOnce({})

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.emailBlacklist.delete).toHaveBeenCalledWith({
        where: { id: 'bl-1' },
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/blacklist')
    })

    it('DBエラーの場合はエラーを返す', async () => {
      mockPrisma.emailBlacklist.delete.mockRejectedValueOnce(new Error('DB error'))

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toEqual({ error: 'ブラックリストからの削除に失敗しました' })
    })
  })

  // ============================================================
  // getEmailBlacklist
  // ============================================================

  describe('getEmailBlacklist', () => {
    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('正常にリストを取得する', async () => {
      const mockItems = [
        { id: 'bl-1', email: 'spam1@example.com', reason: 'スパム', createdBy: 'admin-1', createdAt: new Date() },
        { id: 'bl-2', email: 'spam2@example.com', reason: null, createdBy: 'admin-1', createdAt: new Date() },
      ]
      mockPrisma.emailBlacklist.findMany.mockResolvedValueOnce(mockItems)
      mockPrisma.emailBlacklist.count.mockResolvedValueOnce(2)

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist()

      expect(result).toEqual({
        success: true,
        data: { items: mockItems, total: 2 },
      })
    })

    it('検索オプション付きで取得する', async () => {
      mockPrisma.emailBlacklist.findMany.mockResolvedValueOnce([])
      mockPrisma.emailBlacklist.count.mockResolvedValueOnce(0)

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist({ search: 'spam', limit: 10, offset: 5 })

      expect(result).toEqual({ success: true, data: { items: [], total: 0 } })
      expect(mockPrisma.emailBlacklist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        })
      )
    })

    it('DBエラーの場合はエラーを返す', async () => {
      mockPrisma.emailBlacklist.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist()

      expect(result).toEqual({ error: 'ブラックリストの取得に失敗しました' })
    })
  })

  // ============================================================
  // isEmailBlacklisted
  // ============================================================

  describe('isEmailBlacklisted', () => {
    it('ブラックリストに登録されている場合はtrueを返す', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce({
        id: 'bl-1',
        email: 'spam@example.com',
      })

      const { isEmailBlacklisted } = await import('@/lib/actions/blacklist')
      const result = await isEmailBlacklisted('Spam@Example.com')

      expect(result).toBe(true)
      expect(mockPrisma.emailBlacklist.findUnique).toHaveBeenCalledWith({
        where: { email: 'spam@example.com' },
      })
    })

    it('ブラックリストに登録されていない場合はfalseを返す', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce(null)

      const { isEmailBlacklisted } = await import('@/lib/actions/blacklist')
      const result = await isEmailBlacklisted('clean@example.com')

      expect(result).toBe(false)
    })

    it('DBエラーの場合はfalseを返す', async () => {
      mockPrisma.emailBlacklist.findUnique.mockRejectedValueOnce(new Error('DB error'))

      const { isEmailBlacklisted } = await import('@/lib/actions/blacklist')
      const result = await isEmailBlacklisted('test@example.com')

      expect(result).toBe(false)
    })
  })

  // ============================================================
  // addDeviceToBlacklist
  // ============================================================

  describe('addDeviceToBlacklist', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('短すぎるフィンガープリントはエラーを返す', async () => {
      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('short')

      expect(result).toEqual({ error: '有効なデバイスフィンガープリントを入力してください' })
    })

    it('既に登録されている場合はエラーを返す', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce({
        id: 'dbl-1',
        fingerprint: 'fingerprint123',
      })

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123')

      expect(result).toEqual({ error: 'このデバイスは既にブラックリストに登録されています' })
    })

    it('正常に追加する', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce(null)
      mockPrisma.deviceBlacklist.create.mockResolvedValueOnce({})

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123', '不正行為', 'user@example.com')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.deviceBlacklist.create).toHaveBeenCalledWith({
        data: {
          fingerprint: 'fingerprint123',
          reason: '不正行為',
          originalEmail: 'user@example.com',
          createdBy: 'admin-123',
        },
      })
    })
  })

  // ============================================================
  // removeDeviceFromBlacklist
  // ============================================================

  describe('removeDeviceFromBlacklist', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeDeviceFromBlacklist('dbl-1')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeDeviceFromBlacklist('dbl-1')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('正常に削除する', async () => {
      mockPrisma.deviceBlacklist.delete.mockResolvedValueOnce({})

      const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeDeviceFromBlacklist('dbl-1')

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // getDeviceBlacklist
  // ============================================================

  describe('getDeviceBlacklist', () => {
    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getDeviceBlacklist()

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('正常にリストを取得する', async () => {
      const mockItems = [
        { id: 'dbl-1', fingerprint: 'fp1', reason: '不正', originalEmail: 'user1@example.com', createdBy: 'admin-1', createdAt: new Date() },
      ]
      mockPrisma.deviceBlacklist.findMany.mockResolvedValueOnce(mockItems)
      mockPrisma.deviceBlacklist.count.mockResolvedValueOnce(1)

      const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getDeviceBlacklist()

      expect(result).toEqual({
        success: true,
        data: { items: mockItems, total: 1 },
      })
    })
  })

  // ============================================================
  // isDeviceBlacklisted
  // ============================================================

  describe('isDeviceBlacklisted', () => {
    it('空のフィンガープリントはfalseを返す', async () => {
      const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
      const result = await isDeviceBlacklisted('')

      expect(result).toBe(false)
    })

    it('ブラックリストに登録されている場合はtrueを返す', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce({
        id: 'dbl-1',
        fingerprint: 'bad-device',
      })

      const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
      const result = await isDeviceBlacklisted('bad-device')

      expect(result).toBe(true)
    })

    it('ブラックリストに登録されていない場合はfalseを返す', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce(null)

      const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
      const result = await isDeviceBlacklisted('clean-device')

      expect(result).toBe(false)
    })
  })

  // ============================================================
  // recordUserDevice
  // ============================================================

  describe('recordUserDevice', () => {
    it('userIdがない場合は何もしない', async () => {
      const { recordUserDevice } = await import('@/lib/actions/blacklist')
      await recordUserDevice('', 'fingerprint')

      expect(mockPrisma.userDevice.upsert).not.toHaveBeenCalled()
    })

    it('fingerprintがない場合は何もしない', async () => {
      const { recordUserDevice } = await import('@/lib/actions/blacklist')
      await recordUserDevice('user-123', '')

      expect(mockPrisma.userDevice.upsert).not.toHaveBeenCalled()
    })

    it('正常にデバイスを記録する', async () => {
      mockPrisma.userDevice.upsert.mockResolvedValueOnce({})

      const { recordUserDevice } = await import('@/lib/actions/blacklist')
      await recordUserDevice('user-123', 'fingerprint123', 'Mozilla/5.0', '192.168.1.1')

      expect(mockPrisma.userDevice.upsert).toHaveBeenCalledWith({
        where: {
          userId_fingerprint: { userId: 'user-123', fingerprint: 'fingerprint123' },
        },
        create: {
          userId: 'user-123',
          fingerprint: 'fingerprint123',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        },
        update: expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }),
      })
    })

    it('DBエラーが発生しても例外をスローしない', async () => {
      mockPrisma.userDevice.upsert.mockRejectedValueOnce(new Error('DB error'))

      const { recordUserDevice } = await import('@/lib/actions/blacklist')
      await expect(recordUserDevice('user-123', 'fingerprint123')).resolves.not.toThrow()
    })
  })

  // ============================================================
  // getUserDevices
  // ============================================================

  describe('getUserDevices', () => {
    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { getUserDevices } = await import('@/lib/actions/blacklist')
      const result = await getUserDevices('user-123')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('正常にデバイス一覧を取得する', async () => {
      const mockDevices = [
        { id: 'd1', userId: 'user-123', fingerprint: 'fp1', lastSeenAt: new Date() },
        { id: 'd2', userId: 'user-123', fingerprint: 'fp2', lastSeenAt: new Date() },
      ]
      mockPrisma.userDevice.findMany.mockResolvedValueOnce(mockDevices)

      const { getUserDevices } = await import('@/lib/actions/blacklist')
      const result = await getUserDevices('user-123')

      expect(result).toEqual({ success: true, data: mockDevices })
    })
  })

  // ============================================================
  // blacklistUserDevices
  // ============================================================

  describe('blacklistUserDevices', () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toEqual({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValueOnce(false)

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toEqual({ error: '管理者権限が必要です' })
    })

    it('デバイスがない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ email: 'user@example.com' })
      mockPrisma.userDevice.findMany.mockResolvedValueOnce([])

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toEqual({ error: 'このユーザーに関連付けられたデバイスがありません' })
    })

    it('全て既にブラックリスト登録済みの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ email: 'user@example.com' })
      mockPrisma.userDevice.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' },
        { fingerprint: 'fp2' },
      ])
      mockPrisma.deviceBlacklist.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' },
        { fingerprint: 'fp2' },
      ])

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toEqual({ error: '全てのデバイスは既にブラックリストに登録されています' })
    })

    it('正常にデバイスをブラックリストに追加する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ email: 'user@example.com' })
      mockPrisma.userDevice.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' },
        { fingerprint: 'fp2' },
        { fingerprint: 'fp3' },
      ])
      mockPrisma.deviceBlacklist.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' }, // 既に登録済み
      ])
      mockPrisma.deviceBlacklist.createMany.mockResolvedValueOnce({ count: 2 })

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123', '不正利用')

      expect(result).toEqual({ success: true, data: { count: 2 } })
      expect(mockPrisma.deviceBlacklist.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ fingerprint: 'fp2' }),
          expect.objectContaining({ fingerprint: 'fp3' }),
        ]),
      })
    })
  })
})

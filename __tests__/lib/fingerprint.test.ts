/**
 * フィンガープリントユーティリティのテスト
 *
 * @jest-environment node
 */

// FingerprintJSのモック
const mockGet = jest.fn()
const mockLoad = jest.fn()

jest.mock('@fingerprintjs/fingerprintjs', () => ({
  __esModule: true,
  default: {
    load: () => mockLoad(),
  },
}))

describe('fingerprint', () => {
  // localStorageのモック
  let localStorageMock: { [key: string]: string }
  let mockGetItem: jest.Mock
  let mockSetItem: jest.Mock
  let mockRemoveItem: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    // localStorageをモック
    localStorageMock = {}
    mockGetItem = jest.fn((key: string) => localStorageMock[key] || null)
    mockSetItem = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value
    })
    mockRemoveItem = jest.fn((key: string) => {
      delete localStorageMock[key]
    })

    // globalオブジェクトにwindowとlocalStorageを設定
    // @ts-expect-error - テスト用
    global.window = {}
    // @ts-expect-error - テスト用
    global.localStorage = {
      getItem: mockGetItem,
      setItem: mockSetItem,
      removeItem: mockRemoveItem,
    }

    // FingerprintJSのデフォルト動作
    mockLoad.mockResolvedValue({
      get: mockGet,
    })
    mockGet.mockResolvedValue({
      visitorId: 'test-fingerprint-123',
    })
  })

  afterEach(() => {
    // @ts-expect-error - テスト用
    delete global.window
    // @ts-expect-error - テスト用
    delete global.localStorage
  })

  // ============================================================
  // getFingerprint
  // ============================================================

  describe('getFingerprint', () => {
    it('フィンガープリントを取得する', async () => {
      const { getFingerprint } = await import('@/lib/fingerprint')
      const result = await getFingerprint()

      expect(result).toBe('test-fingerprint-123')
      expect(mockLoad).toHaveBeenCalled()
      expect(mockGet).toHaveBeenCalled()
    })

    it('サーバーサイドではnullを返す', async () => {
      // @ts-expect-error - テスト用
      delete global.window

      const { getFingerprint } = await import('@/lib/fingerprint')
      const result = await getFingerprint()

      expect(result).toBeNull()
    })

    it('エラー時はnullを返す', async () => {
      mockLoad.mockRejectedValueOnce(new Error('FP error'))

      const { getFingerprint } = await import('@/lib/fingerprint')
      const result = await getFingerprint()

      expect(result).toBeNull()
    })
  })

  // ============================================================
  // getCachedFingerprint
  // ============================================================

  describe('getCachedFingerprint', () => {
    it('キャッシュされたフィンガープリントを返す', async () => {
      const cached = {
        value: 'cached-fingerprint',
        timestamp: Date.now(),
      }
      localStorageMock['device_fp'] = JSON.stringify(cached)

      const { getCachedFingerprint } = await import('@/lib/fingerprint')
      const result = getCachedFingerprint()

      expect(result).toBe('cached-fingerprint')
    })

    it('キャッシュがない場合はnullを返す', async () => {
      const { getCachedFingerprint } = await import('@/lib/fingerprint')
      const result = getCachedFingerprint()

      expect(result).toBeNull()
    })

    it('キャッシュが期限切れの場合はnullを返し、キャッシュを削除する', async () => {
      const expired = {
        value: 'expired-fingerprint',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25時間前
      }
      localStorageMock['device_fp'] = JSON.stringify(expired)

      const { getCachedFingerprint } = await import('@/lib/fingerprint')
      const result = getCachedFingerprint()

      expect(result).toBeNull()
      expect(mockRemoveItem).toHaveBeenCalledWith('device_fp')
    })

    it('無効なJSONの場合はnullを返す', async () => {
      localStorageMock['device_fp'] = 'invalid-json'

      const { getCachedFingerprint } = await import('@/lib/fingerprint')
      const result = getCachedFingerprint()

      expect(result).toBeNull()
    })

    it('サーバーサイドではnullを返す', async () => {
      // @ts-expect-error - テスト用
      delete global.window

      const { getCachedFingerprint } = await import('@/lib/fingerprint')
      const result = getCachedFingerprint()

      expect(result).toBeNull()
    })
  })

  // ============================================================
  // cacheFingerprint
  // ============================================================

  describe('cacheFingerprint', () => {
    it('フィンガープリントをキャッシュに保存する', async () => {
      const { cacheFingerprint } = await import('@/lib/fingerprint')
      cacheFingerprint('new-fingerprint')

      expect(mockSetItem).toHaveBeenCalledWith(
        'device_fp',
        expect.stringContaining('new-fingerprint')
      )
    })

    it('サーバーサイドでは何もしない', async () => {
      // @ts-expect-error - テスト用
      delete global.window

      const { cacheFingerprint } = await import('@/lib/fingerprint')
      cacheFingerprint('new-fingerprint')

      expect(mockSetItem).not.toHaveBeenCalled()
    })

    it('localStorageエラーでも例外をスローしない', async () => {
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      const { cacheFingerprint } = await import('@/lib/fingerprint')
      expect(() => cacheFingerprint('new-fingerprint')).not.toThrow()
    })
  })

  // ============================================================
  // getFingerprintWithCache
  // ============================================================

  describe('getFingerprintWithCache', () => {
    it('キャッシュがあればキャッシュを返す', async () => {
      const cached = {
        value: 'cached-fingerprint',
        timestamp: Date.now(),
      }
      localStorageMock['device_fp'] = JSON.stringify(cached)

      const { getFingerprintWithCache } = await import('@/lib/fingerprint')
      const result = await getFingerprintWithCache()

      expect(result).toBe('cached-fingerprint')
      expect(mockLoad).not.toHaveBeenCalled()
    })

    it('キャッシュがなければ新規取得してキャッシュする', async () => {
      const { getFingerprintWithCache } = await import('@/lib/fingerprint')
      const result = await getFingerprintWithCache()

      expect(result).toBe('test-fingerprint-123')
      expect(mockLoad).toHaveBeenCalled()
      expect(mockSetItem).toHaveBeenCalled()
    })

    it('新規取得に失敗した場合はキャッシュしない', async () => {
      mockLoad.mockRejectedValueOnce(new Error('FP error'))

      const { getFingerprintWithCache } = await import('@/lib/fingerprint')
      const result = await getFingerprintWithCache()

      expect(result).toBeNull()
      expect(mockSetItem).not.toHaveBeenCalled()
    })
  })
})

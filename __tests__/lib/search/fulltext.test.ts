/**
 * @jest-environment node
 */

// Prisma mock
const mockQueryRaw = jest.fn()
const mockExecuteRaw = jest.fn()
const mockExecuteRawUnsafe = jest.fn()

jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}))

// Logger mock
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Fulltext Search Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    delete process.env.SEARCH_MODE
  })

  describe('getSearchMode', () => {
    it('デフォルトはlike', async () => {
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('like')
    })

    it('SEARCH_MODE=bigmでbigmを返す', async () => {
      process.env.SEARCH_MODE = 'bigm'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('bigm')
    })

    it('SEARCH_MODE=trgmでtrgmを返す', async () => {
      process.env.SEARCH_MODE = 'trgm'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('trgm')
    })

    it('SEARCH_MODE=BIGMでも大文字小文字を無視する', async () => {
      process.env.SEARCH_MODE = 'BIGM'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('bigm')
    })

    it('無効な値はlikeにフォールバック', async () => {
      process.env.SEARCH_MODE = 'invalid'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('like')
    })
  })

  describe('checkExtensionAvailable', () => {
    it('拡張機能が利用可能な場合はtrueを返す', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ available: true }])

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_bigm')

      expect(result).toBe(true)
    })

    it('拡張機能が利用不可の場合はfalseを返す', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ available: false }])

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_trgm')

      expect(result).toBe(false)
    })

    it('エラー時はfalseを返す', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('DB error'))

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_bigm')

      expect(result).toBe(false)
    })

    it('結果が空の場合はfalseを返す', async () => {
      mockQueryRaw.mockResolvedValueOnce([])

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_bigm')

      expect(result).toBe(false)
    })
  })

  describe('enableExtension', () => {
    it('拡張機能を有効化できる', async () => {
      mockExecuteRawUnsafe.mockResolvedValueOnce(undefined)

      const { enableExtension } = await import('@/lib/search/fulltext')
      const result = await enableExtension('pg_bigm')

      expect(result).toBe(true)
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS "pg_bigm"')
    })

    it('pg_trgmを有効化できる', async () => {
      mockExecuteRawUnsafe.mockResolvedValueOnce(undefined)

      const { enableExtension } = await import('@/lib/search/fulltext')
      const result = await enableExtension('pg_trgm')

      expect(result).toBe(true)
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')
    })

    it('エラー時はfalseを返す', async () => {
      mockExecuteRawUnsafe.mockRejectedValueOnce(new Error('Permission denied'))

      const { enableExtension } = await import('@/lib/search/fulltext')
      const result = await enableExtension('pg_bigm')

      expect(result).toBe(false)
    })
  })

  describe('createSearchIndexes', () => {
    it('likeモードではインデックスを作成しない', async () => {
      process.env.SEARCH_MODE = 'like'

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(true)
      expect(result.message).toContain('LIKE検索モード')
      expect(mockExecuteRaw).not.toHaveBeenCalled()
    })

    it('bigmモードでインデックスを作成する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockExecuteRaw.mockResolvedValue(undefined)

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(true)
      expect(result.message).toContain('pg_bigm')
      expect(mockExecuteRaw).toHaveBeenCalledTimes(3)
    })

    it('trgmモードでインデックスを作成する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockExecuteRaw.mockResolvedValue(undefined)

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(true)
      expect(result.message).toContain('pg_trgm')
      expect(mockExecuteRaw).toHaveBeenCalledTimes(3)
    })

    it('エラー時は失敗を返す', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockExecuteRaw.mockRejectedValueOnce(new Error('Index creation failed'))

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(false)
      expect(result.message).toContain('失敗')
    })
  })

  describe('fulltextSearchPosts', () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('')

      expect(result).toEqual([])
    })

    it('空白のみのクエリは空配列を返す', async () => {
      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('   ')

      expect(result).toEqual([])
    })

    it('likeモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }, { id: 'post-2' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['post-1', 'post-2'])
    })

    it('bigmモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('黒松')

      expect(result).toEqual(['post-1'])
    })

    it('trgmモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('真柏')

      expect(result).toEqual(['post-1'])
    })

    it('エラー時はLIKE検索にフォールバックする', async () => {
      process.env.SEARCH_MODE = 'bigm'
      // 最初のクエリ（bigm）は失敗
      mockQueryRaw.mockRejectedValueOnce(new Error('Extension not found'))
      // フォールバック（like）は成功
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['post-1'])
    })

    it('オプションでlimitを指定できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', { limit: 10 })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('シングルクォートをエスケープする', async () => {
      mockQueryRaw.mockResolvedValueOnce([])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts("test'query")

      // SQL実行時にエラーが発生しないことを確認
      expect(mockQueryRaw).toHaveBeenCalled()
    })
  })

  describe('fulltextSearchUsers', () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('')

      expect(result).toEqual([])
    })

    it('likeモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽好き')

      expect(result).toEqual(['user-1'])
    })

    it('bigmモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('ユーザー')

      expect(result).toEqual(['user-1'])
    })

    it('excludedUserIdsでユーザーを除外できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { excludedUserIds: ['user-1'] })

      expect(result).toEqual(['user-2'])
    })
  })
})

/**
 * @jest-environment node
 */

// loggerモック
const mockLoggerError = jest.fn()
jest.mock('@/lib/logger', () => {
  return {
    __esModule: true,
    default: {
      error: (...args: unknown[]) => mockLoggerError(...args),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
  }
})

describe('Utils Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('safeAction', () => {
    it('成功時はsuccessとdataを返す', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => {
        return { id: '1', name: 'test' }
      })

      expect(result).toEqual({
        success: true,
        data: { id: '1', name: 'test' },
      })
    })

    it('成功時にundefinedを返す場合もsuccessを返す', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => {
        // 何も返さない
      })

      expect(result).toEqual({
        success: true,
        data: undefined,
      })
    })

    it('エラー発生時はerrorを返す', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => {
        throw new Error('テストエラー')
      })

      expect(result).toEqual({
        success: false,
        error: 'テストエラー',
      })
    })

    it('Errorインスタンスでない場合はデフォルトメッセージを返す', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => {
        throw 'string error'
      })

      expect(result).toEqual({
        success: false,
        error: '処理中にエラーが発生しました',
      })
    })

    it('カスタムエラーメッセージを返す', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => {
        throw 'string error'
      }, 'カスタムエラーメッセージ')

      expect(result).toEqual({
        success: false,
        error: 'カスタムエラーメッセージ',
      })
    })

    it('エラー時はログを出力する', async () => {
      const { safeAction } = await import('@/lib/actions/utils')

      await safeAction(async () => {
        throw new Error('テストエラー')
      })

      expect(mockLoggerError).toHaveBeenCalledWith('Server Action error:', expect.any(Error))
    })
  })

  describe('authAction', () => {
    it('userIdがundefinedの場合は認証エラーを返す', async () => {
      const { authAction } = await import('@/lib/actions/utils')
      const result = await authAction(undefined, async (userId) => {
        return { userId }
      })

      expect(result).toEqual({
        success: false,
        error: '認証が必要です',
      })
    })

    it('userIdがあれば処理を実行する', async () => {
      const { authAction } = await import('@/lib/actions/utils')
      const result = await authAction('user-id', async (userId) => {
        return { userId }
      })

      expect(result).toEqual({
        success: true,
        data: { userId: 'user-id' },
      })
    })

    it('処理中にエラーが発生した場合はエラーを返す', async () => {
      const { authAction } = await import('@/lib/actions/utils')
      const result = await authAction('user-id', async () => {
        throw new Error('処理エラー')
      })

      expect(result).toEqual({
        success: false,
        error: '処理エラー',
      })
    })

    it('カスタムエラーメッセージを返す', async () => {
      const { authAction } = await import('@/lib/actions/utils')
      const result = await authAction(
        'user-id',
        async () => {
          throw 'not an error'
        },
        'カスタムエラーメッセージ'
      )

      expect(result).toEqual({
        success: false,
        error: 'カスタムエラーメッセージ',
      })
    })

    it('空文字のuserIdも未認証とみなす', async () => {
      const { authAction } = await import('@/lib/actions/utils')
      const result = await authAction('', async (userId) => {
        return { userId }
      })

      expect(result).toEqual({
        success: false,
        error: '認証が必要です',
      })
    })
  })

  describe('errorResponse', () => {
    it('エラーレスポンスを生成する', async () => {
      const { errorResponse } = await import('@/lib/actions/utils')
      const result = errorResponse('エラーメッセージ')

      expect(result).toEqual({
        error: 'エラーメッセージ',
      })
    })

    it('空のメッセージでも動作する', async () => {
      const { errorResponse } = await import('@/lib/actions/utils')
      const result = errorResponse('')

      expect(result).toEqual({
        error: '',
      })
    })
  })

  describe('successResponse', () => {
    it('データなしの成功レスポンスを生成する', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse()

      expect(result).toEqual({
        success: true,
      })
    })

    it('データありの成功レスポンスを生成する', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse({ postId: '123' })

      expect(result).toEqual({
        success: true,
        data: { postId: '123' },
      })
    })

    it('nullをデータとして渡すとdataプロパティに含まれる', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse(null)

      expect(result).toEqual({
        success: true,
        data: null,
      })
    })

    it('配列をデータとして渡せる', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse([1, 2, 3])

      expect(result).toEqual({
        success: true,
        data: [1, 2, 3],
      })
    })

    it('プリミティブ値をデータとして渡せる', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse(42)

      expect(result).toEqual({
        success: true,
        data: 42,
      })
    })

    it('falseをデータとして渡すとdataプロパティに含まれる', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse(false)

      expect(result).toEqual({
        success: true,
        data: false,
      })
    })

    it('0をデータとして渡すとdataプロパティに含まれる', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse(0)

      expect(result).toEqual({
        success: true,
        data: 0,
      })
    })

    it('空文字をデータとして渡すとdataプロパティに含まれる', async () => {
      const { successResponse } = await import('@/lib/actions/utils')
      const result = successResponse('')

      expect(result).toEqual({
        success: true,
        data: '',
      })
    })
  })

  describe('ActionResult型の使用例', () => {
    it('成功時の型判定', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => ({ id: '1' }))

      if (result.success) {
        // TypeScriptはこのブロック内でresult.dataにアクセスできることを保証
        expect(result.data).toEqual({ id: '1' })
      }
    })

    it('失敗時の型判定', async () => {
      const { safeAction } = await import('@/lib/actions/utils')
      const result = await safeAction(async () => {
        throw new Error('エラー')
      })

      if (!result.success) {
        // TypeScriptはこのブロック内でresult.errorにアクセスできることを保証
        expect(result.error).toBe('エラー')
      }
    })
  })
})

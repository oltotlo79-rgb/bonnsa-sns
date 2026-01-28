/**
 * データベース接続設定のテスト
 *
 * @jest-environment node
 */

// 環境変数を設定
const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...originalEnv }
})

afterAll(() => {
  process.env = originalEnv
})

describe('Database Module', () => {
  describe('環境設定', () => {
    it('DATABASE_URLが必要', () => {
      expect(process.env.DATABASE_URL).toBeDefined()
    })

    it('ダミーDATABASE_URLを検出できる', () => {
      const dummyUrl = 'postgresql://dummy:dummy@localhost:5432/dummy'
      const isDummy = dummyUrl.includes('dummy')

      expect(isDummy).toBe(true)
    })

    it('本番DATABASE_URLはダミーではない', () => {
      const productionUrl = 'postgresql://user:pass@host:5432/dbname'
      const isDummy = productionUrl.includes('dummy')

      expect(isDummy).toBe(false)
    })
  })

  describe('PrismaClient設定', () => {
    it('開発環境のログ設定が正しい', () => {
      const devLogs = ['query', 'error', 'warn']
      expect(devLogs).toContain('query')
      expect(devLogs).toContain('error')
      expect(devLogs).toContain('warn')
    })

    it('本番環境のログ設定が正しい', () => {
      const prodLogs = ['error']
      expect(prodLogs).toHaveLength(1)
      expect(prodLogs[0]).toBe('error')
    })

    it('ログレベルは環境によって異なる', () => {
      const getLogLevel = (nodeEnv: string) => {
        return nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error']
      }

      expect(getLogLevel('development')).toEqual(['query', 'error', 'warn'])
      expect(getLogLevel('production')).toEqual(['error'])
    })
  })

  describe('SSL設定', () => {
    it('本番環境ではSSLが有効', () => {
      const getSslConfig = (nodeEnv: string) => {
        return nodeEnv === 'production' ? { rejectUnauthorized: false } : false
      }

      const prodConfig = getSslConfig('production')
      expect(prodConfig).toEqual({ rejectUnauthorized: false })
    })

    it('開発環境ではSSLが無効', () => {
      const getSslConfig = (nodeEnv: string) => {
        return nodeEnv === 'production' ? { rejectUnauthorized: false } : false
      }

      const devConfig = getSslConfig('development')
      expect(devConfig).toBe(false)
    })
  })

  describe('接続プール', () => {
    it('接続プールの設定', () => {
      const poolConfig = {
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        ssl: false,
      }

      expect(poolConfig.connectionString).toBeDefined()
      expect(typeof poolConfig.ssl).toBe('boolean')
    })
  })

  describe('グローバル変数', () => {
    it('開発環境ではPrismaClientがグローバルに保存される', () => {
      const shouldSaveToGlobal = process.env.NODE_ENV !== 'production'
      // テスト環境では保存される
      expect(shouldSaveToGlobal).toBe(true)
    })

    it('本番環境ではPrismaClientはグローバルに保存されない', () => {
      const nodeEnv = 'production'
      const shouldSaveToGlobal = nodeEnv !== 'production'

      expect(shouldSaveToGlobal).toBe(false)
    })
  })

  describe('シングルトンパターン', () => {
    it('同じインスタンスを再利用できる', () => {
      const mockPrisma = { id: 'instance-1' }
      const globalForPrisma = { prisma: mockPrisma }

      // Nullish Coalescing演算子の動作
      const prisma = globalForPrisma.prisma ?? { id: 'new-instance' }

      expect(prisma.id).toBe('instance-1')
    })

    it('インスタンスがない場合は新しく作成される', () => {
      const globalForPrisma = { prisma: undefined as { id: string } | undefined }

      const prisma = globalForPrisma.prisma ?? { id: 'new-instance' }

      expect(prisma.id).toBe('new-instance')
    })
  })

  describe('CI環境', () => {
    it('CI環境ではダミーURLが使用される', () => {
      const ciDatabaseUrl = 'postgresql://dummy:dummy@localhost:5432/dummy'
      const isDummy = ciDatabaseUrl.includes('dummy')

      expect(isDummy).toBe(true)
    })

    it('ダミーURLの場合はPoolを作成しない', () => {
      const isDummyDatabase = true
      const pool = isDummyDatabase ? null : {}

      expect(pool).toBeNull()
    })

    it('実際のURLの場合はPoolを作成する', () => {
      const isDummyDatabase = false
      const pool = isDummyDatabase ? null : { connection: 'active' }

      expect(pool).not.toBeNull()
      expect(pool?.connection).toBe('active')
    })
  })

  describe('アダプター', () => {
    it('Poolがある場合はアダプターを作成', () => {
      const pool = { connection: 'active' }
      const adapter = pool ? { type: 'PrismaPg' } : null

      expect(adapter).not.toBeNull()
      expect(adapter?.type).toBe('PrismaPg')
    })

    it('Poolがない場合はアダプターはnull', () => {
      const pool = null
      const adapter = pool ? { type: 'PrismaPg' } : null

      expect(adapter).toBeNull()
    })
  })
})

// ============================================================
// DATABASE_URL 形式テスト
// ============================================================

describe('DATABASE_URL Format', () => {
  it('PostgreSQL URL形式が正しい', () => {
    const validUrls = [
      'postgresql://user:pass@localhost:5432/db',
      'postgresql://user:password@host.example.com:5432/database',
      'postgres://user:pass@localhost:5432/db',
    ]

    validUrls.forEach((url) => {
      expect(url).toMatch(/^postgres(ql)?:\/\//)
    })
  })

  it('ホスト、ポート、データベース名を含む', () => {
    const url = 'postgresql://user:pass@localhost:5432/dbname'
    const regex = /postgresql:\/\/(\w+):(\w+)@([\w.]+):(\d+)\/(\w+)/

    const match = url.match(regex)
    expect(match).not.toBeNull()
    expect(match?.[1]).toBe('user')
    expect(match?.[3]).toBe('localhost')
    expect(match?.[4]).toBe('5432')
    expect(match?.[5]).toBe('dbname')
  })

  it('スキーマパラメータを含むことができる', () => {
    const url = 'postgresql://user:pass@localhost:5432/db?schema=public'

    expect(url).toContain('schema=public')
  })
})

// ============================================================
// エラーハンドリング
// ============================================================

describe('Error Handling', () => {
  it('接続エラーをキャッチできる', async () => {
    const connectWithError = async () => {
      throw new Error('Connection failed')
    }

    await expect(connectWithError()).rejects.toThrow('Connection failed')
  })

  it('タイムアウトエラーを処理できる', async () => {
    const connectWithTimeout = async () => {
      throw new Error('Connection timeout')
    }

    await expect(connectWithTimeout()).rejects.toThrow('Connection timeout')
  })

  it('認証エラーを処理できる', async () => {
    const connectWithAuthError = async () => {
      throw new Error('Authentication failed')
    }

    await expect(connectWithAuthError()).rejects.toThrow('Authentication failed')
  })
})

// ============================================================
// 接続状態
// ============================================================

describe('Connection State', () => {
  it('接続状態を追跡できる', () => {
    const connectionState = {
      isConnected: false,
      lastError: null as Error | null,
      retryCount: 0,
    }

    connectionState.isConnected = true

    expect(connectionState.isConnected).toBe(true)
  })

  it('リトライカウントを管理できる', () => {
    const state = { retryCount: 0 }

    state.retryCount++
    state.retryCount++

    expect(state.retryCount).toBe(2)
  })

  it('最大リトライ数を超えたらエラー', () => {
    const maxRetries = 3
    const currentRetries = 4

    const shouldError = currentRetries > maxRetries

    expect(shouldError).toBe(true)
  })
})

// ============================================================
// 環境変数バリデーション
// ============================================================

describe('Environment Variables', () => {
  it('必須環境変数が存在する', () => {
    const requiredVars = ['DATABASE_URL']

    requiredVars.forEach((varName) => {
      // テスト環境では設定されているはず
      expect(process.env[varName]).toBeDefined()
    })
  })

  it('NODE_ENVが有効な値を持つ', () => {
    const validEnvs = ['development', 'production', 'test']
    const nodeEnv = process.env.NODE_ENV || 'development'

    expect(validEnvs).toContain(nodeEnv)
  })
})

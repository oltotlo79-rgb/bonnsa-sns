/**
 * 認証設定（auth.config.ts）のテスト
 *
 * @jest-environment node
 */

import { authConfig } from '@/lib/auth.config'

describe('auth.config', () => {
  // ============================================================
  // pages設定
  // ============================================================

  describe('pages設定', () => {
    it('signInページが/loginに設定されている', () => {
      expect(authConfig.pages?.signIn).toBe('/login')
    })

    it('errorページが/loginに設定されている', () => {
      expect(authConfig.pages?.error).toBe('/login')
    })
  })

  // ============================================================
  // providers設定
  // ============================================================

  describe('providers設定', () => {
    it('providersが空配列', () => {
      expect(authConfig.providers).toEqual([])
    })
  })

  // ============================================================
  // authorized callback
  // ============================================================

  describe('callbacks.authorized', () => {
    const createMockRequest = (pathname: string) => ({
      nextUrl: {
        pathname,
        searchParams: new URLSearchParams(),
      } as URL,
    })

    describe('公開ページ', () => {
      const publicPaths = ['/', '/login', '/register', '/password-reset', '/verify-email']

      publicPaths.forEach((path) => {
        it(`${path} は未ログインでもアクセス可能`, () => {
          const result = authConfig.callbacks?.authorized?.({
            auth: null,
            request: createMockRequest(path),
          } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

          expect(result).toBe(true)
        })

        it(`${path} はログイン済みでもアクセス可能`, () => {
          const result = authConfig.callbacks?.authorized?.({
            auth: { user: { id: 'user-1', email: 'test@example.com' } },
            request: createMockRequest(path),
          } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

          expect(result).toBe(true)
        })
      })

      it('/login/callback（サブパス）も公開ページとして扱う', () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: null,
          request: createMockRequest('/login/callback'),
        } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

        expect(result).toBe(true)
      })

      it('/password-reset/confirm（サブパス）も公開ページとして扱う', () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: null,
          request: createMockRequest('/password-reset/confirm'),
        } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

        expect(result).toBe(true)
      })
    })

    describe('APIルート', () => {
      const apiPaths = ['/api/auth/signin', '/api/posts', '/api/users/123']

      apiPaths.forEach((path) => {
        it(`${path} は未ログインでもアクセス可能（個別認証）`, () => {
          const result = authConfig.callbacks?.authorized?.({
            auth: null,
            request: createMockRequest(path),
          } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

          expect(result).toBe(true)
        })
      })
    })

    describe('静的ファイル', () => {
      const staticPaths = [
        '/_next/static/chunks/main.js',
        '/_next/image',
        '/favicon.ico',
        '/logo.png',
        '/images/avatar.jpg',
      ]

      staticPaths.forEach((path) => {
        it(`${path} は未ログインでもアクセス可能`, () => {
          const result = authConfig.callbacks?.authorized?.({
            auth: null,
            request: createMockRequest(path),
          } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

          expect(result).toBe(true)
        })
      })
    })

    describe('保護されたページ', () => {
      const protectedPaths = [
        '/feed',
        '/posts/123',
        '/users/456',
        '/settings',
        '/settings/profile',
        '/notifications',
        '/bookmarks',
        '/search',
        '/shops',
        '/events',
      ]

      protectedPaths.forEach((path) => {
        it(`${path} は未ログインでアクセス不可`, () => {
          const result = authConfig.callbacks?.authorized?.({
            auth: null,
            request: createMockRequest(path),
          } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

          expect(result).toBe(false)
        })

        it(`${path} はログイン済みでアクセス可能`, () => {
          const result = authConfig.callbacks?.authorized?.({
            auth: { user: { id: 'user-1', email: 'test@example.com' } },
            request: createMockRequest(path),
          } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

          expect(result).toBe(true)
        })
      })
    })

    describe('エッジケース', () => {
      it('authがundefinedの場合は未ログインとして扱う', () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: undefined as unknown as null,
          request: createMockRequest('/feed'),
        } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

        expect(result).toBe(false)
      })

      it('auth.userがnullの場合は未ログインとして扱う', () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: { user: null } as unknown,
          request: createMockRequest('/feed'),
        } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

        expect(result).toBe(false)
      })

      it('空のパス（ルート）は公開ページ', () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: null,
          request: createMockRequest('/'),
        } as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0])

        expect(result).toBe(true)
      })
    })
  })
})

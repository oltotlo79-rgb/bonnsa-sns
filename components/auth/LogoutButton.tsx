'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      ログアウト
    </Button>
  )
}

'use server'

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  // メール重複チェック
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existingUser) {
    return { error: 'このメールアドレスは既に登録されています' }
  }

  // パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(data.password, 10)

  // ユーザー作成
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })

  return { success: true, userId: user.id }
}

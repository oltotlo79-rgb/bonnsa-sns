import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { authConfig } from '@/lib/auth.config' // インポート

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig, // configを展開
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      async authorize(credentials) {
        const result = loginSchema.safeParse(credentials)
        if (!result.success) return null

        const { email, password } = result.data
        const user = await prisma.user.findUnique({ where: { email } })

        if (!user || !user.password) return null

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nickname,
          image: user.avatarUrl,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})

// ユーザー登録関数（これは別のファイル lib/user.ts などに分けるのがより綺麗です）
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })
  if (existingUser) throw new Error('このメールアドレスは既に使用されています')

  const hashedPassword = await bcrypt.hash(data.password, 12)
  return await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })
}
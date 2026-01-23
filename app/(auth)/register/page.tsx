import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-serif text-xl text-center text-sumi mb-6 tracking-wide">新規登録</h1>
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />
      <RegisterForm />
    </div>
  )
}

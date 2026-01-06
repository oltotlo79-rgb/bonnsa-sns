import { createClient } from '@/lib/supabase/server'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">タイムライン</h2>
      <p className="text-muted-foreground">
        ようこそ、{user?.email} さん！
      </p>
      <p className="text-muted-foreground mt-4">
        投稿機能は次のチケットで実装されます。
      </p>
    </div>
  )
}

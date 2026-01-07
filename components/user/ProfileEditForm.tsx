'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProfile } from '@/lib/actions/user'
import { AvatarUploader } from './AvatarUploader'
import { HeaderUploader } from './HeaderUploader'

type ProfileEditFormProps = {
  user: {
    id: string
    nickname: string
    bio: string | null
    location: string | null
    avatar_url: string | null
    header_url: string | null
  }
}

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー画像 */}
      <div>
        <Label>ヘッダー画像</Label>
        <HeaderUploader currentUrl={user.header_url} />
      </div>

      {/* アバター画像 */}
      <div>
        <Label>プロフィール画像</Label>
        <AvatarUploader currentUrl={user.avatar_url} nickname={user.nickname} />
      </div>

      {/* テキストフォーム */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nickname">ニックネーム *</Label>
          <Input
            id="nickname"
            name="nickname"
            defaultValue={user.nickname}
            required
            maxLength={50}
            placeholder="ニックネーム"
          />
          <p className="text-xs text-muted-foreground">最大50文字</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">居住地域</Label>
          <Input
            id="location"
            name="location"
            defaultValue={user.location || ''}
            maxLength={100}
            placeholder="例: 東京都"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">自己紹介</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={user.bio || ''}
            maxLength={200}
            rows={4}
            placeholder="自己紹介を入力..."
          />
          <p className="text-xs text-muted-foreground">最大200文字</p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {success && (
          <p className="text-sm text-bonsai-green">プロフィールを更新しました</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '保存中...' : '保存する'}
        </Button>
      </form>
    </div>
  )
}

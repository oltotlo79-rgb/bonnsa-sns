'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBonsai, updateBonsai } from '@/lib/actions/bonsai'

interface BonsaiFormProps {
  bonsai?: {
    id: string
    name: string
    species: string | null
    acquiredAt: Date | null
    description: string | null
  }
}

export function BonsaiForm({ bonsai }: BonsaiFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      species: formData.get('species') as string || undefined,
      acquiredAt: formData.get('acquiredAt')
        ? new Date(formData.get('acquiredAt') as string)
        : undefined,
      description: formData.get('description') as string || undefined,
    }

    try {
      if (bonsai) {
        const result = await updateBonsai(bonsai.id, data)
        if (result.error) {
          setError(result.error)
          return
        }
        router.push(`/bonsai/${bonsai.id}`)
      } else {
        const result = await createBonsai(data)
        if (result.error) {
          setError(result.error)
          return
        }
        if (result.bonsai) {
          router.push(`/bonsai/${result.bonsai.id}`)
        }
      }
      router.refresh()
    } catch {
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          名前 <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={bonsai?.name || ''}
          required
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: 黒松一号"
        />
      </div>

      <div>
        <label htmlFor="species" className="block text-sm font-medium mb-1">
          樹種
        </label>
        <select
          id="species"
          name="species"
          defaultValue={bonsai?.species || ''}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">選択してください</option>
          <option value="松柏類">松柏類</option>
          <option value="雑木類">雑木類</option>
          <option value="草もの">草もの</option>
        </select>
      </div>

      <div>
        <label htmlFor="acquiredAt" className="block text-sm font-medium mb-1">
          入手日
        </label>
        <input
          type="date"
          id="acquiredAt"
          name="acquiredAt"
          defaultValue={
            bonsai?.acquiredAt
              ? new Date(bonsai.acquiredAt).toISOString().split('T')[0]
              : ''
          }
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          メモ
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={bonsai?.description || ''}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="この盆栽についてのメモを入力"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '保存中...' : bonsai ? '更新' : '登録'}
        </button>
      </div>
    </form>
  )
}

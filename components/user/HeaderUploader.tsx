'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type HeaderUploaderProps = {
  currentUrl: string | null
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function HeaderUploader({ currentUrl }: HeaderUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // プレビュー表示
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // アップロード
    handleUpload(file)
  }

  async function handleUpload(file: File) {
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload/header', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setError(result.error || 'アップロードに失敗しました')
        setPreview(currentUrl)
      } else {
        router.refresh()
      }
    } catch {
      setError('アップロードに失敗しました')
      setPreview(currentUrl)
    }

    setLoading(false)
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        className="relative h-32 rounded-lg bg-muted overflow-hidden cursor-pointer group"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <Image
            src={preview}
            alt="ヘッダー画像"
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <CameraIcon className="w-8 h-8" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {loading ? (
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Button variant="secondary" size="sm">
              <CameraIcon className="w-4 h-4 mr-2" />
              変更する
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        JPEG、PNG、WebP形式（5MB以下）、推奨サイズ: 1500x500px
      </p>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'

type ToastVariant = 'default' | 'destructive'

type Toast = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
}

type ToastState = {
  toasts: Toast[]
}

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9)
  const newToast = { ...toast, id }

  memoryState = {
    toasts: [...memoryState.toasts, newToast],
  }

  listeners.forEach((listener) => listener(memoryState))

  // 3秒後に自動で削除
  setTimeout(() => {
    memoryState = {
      toasts: memoryState.toasts.filter((t) => t.id !== id),
    }
    listeners.forEach((listener) => listener(memoryState))
  }, 3000)
}

export function useToast() {
  const [state, setState] = useState<ToastState>(memoryState)

  // リスナーに追加
  useState(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  })

  const toast = useCallback((props: Omit<Toast, 'id'>) => {
    dispatch(props)
  }, [])

  return {
    toast,
    toasts: state.toasts,
  }
}

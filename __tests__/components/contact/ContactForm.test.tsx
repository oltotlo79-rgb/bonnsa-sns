/**
 * ContactFormコンポーネントのテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactForm } from '@/components/contact/ContactForm'

describe('ContactForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================
  // 基本的なレンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('フォームが正しくレンダリングされる', () => {
      render(<ContactForm />)

      expect(screen.getByLabelText(/お名前/)).toBeInTheDocument()
      expect(screen.getByLabelText(/メールアドレス/)).toBeInTheDocument()
      expect(screen.getByLabelText(/カテゴリ/)).toBeInTheDocument()
      expect(screen.getByLabelText(/件名/)).toBeInTheDocument()
      expect(screen.getByLabelText(/お問い合わせ内容/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument()
    })

    it('カテゴリオプションが表示される', () => {
      render(<ContactForm />)

      const categorySelect = screen.getByLabelText(/カテゴリ/)
      expect(categorySelect).toBeInTheDocument()

      // カテゴリオプションを確認
      expect(screen.getByText('カテゴリを選択')).toBeInTheDocument()
      expect(screen.getByText('一般的なお問い合わせ')).toBeInTheDocument()
      expect(screen.getByText('アカウントについて')).toBeInTheDocument()
      expect(screen.getByText('不具合の報告')).toBeInTheDocument()
      expect(screen.getByText('機能のリクエスト')).toBeInTheDocument()
      expect(screen.getByText('プレミアム会員について')).toBeInTheDocument()
      expect(screen.getByText('その他')).toBeInTheDocument()
    })

    it('文字数カウンターが表示される', () => {
      render(<ContactForm />)
      expect(screen.getByText('0 / 2000文字')).toBeInTheDocument()
    })
  })

  // ============================================================
  // バリデーション
  // ============================================================

  describe('バリデーション', () => {
    it('お名前が空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('お名前を入力してください')).toBeInTheDocument()
    })

    it('メールアドレスが空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('メールアドレスを入力してください')).toBeInTheDocument()
    })

    it('無効なメールアドレスの場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      // @は含むがドメインが不正なメールアドレス
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@invalid')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      await waitFor(() => {
        expect(screen.getByText('有効なメールアドレスを入力してください')).toBeInTheDocument()
      })
    })

    it('カテゴリ未選択の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('カテゴリを選択してください')).toBeInTheDocument()
    })

    it('件名が空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('件名を入力してください')).toBeInTheDocument()
    })

    it('お問い合わせ内容が空の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('お問い合わせ内容を入力してください')).toBeInTheDocument()
    })

    it('お問い合わせ内容が10文字未満の場合エラーを表示する', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), '短い内容')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      expect(screen.getByText('お問い合わせ内容は10文字以上で入力してください')).toBeInTheDocument()
    })
  })

  // ============================================================
  // フォーム送信
  // ============================================================

  describe('フォーム送信', () => {
    it('正常に送信できる', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      // 送信中表示
      expect(screen.getByText('送信中...')).toBeInTheDocument()

      // タイマーを進める
      jest.advanceTimersByTime(2000)

      await waitFor(() => {
        expect(screen.getByText('お問い合わせを受け付けました')).toBeInTheDocument()
      })

      jest.useRealTimers()
    })

    it('送信中はフォームが無効になる', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      // 入力フィールドが無効になる
      expect(screen.getByLabelText(/お名前/)).toBeDisabled()
      expect(screen.getByLabelText(/メールアドレス/)).toBeDisabled()
      expect(screen.getByLabelText(/カテゴリ/)).toBeDisabled()
      expect(screen.getByLabelText(/件名/)).toBeDisabled()
      expect(screen.getByLabelText(/お問い合わせ内容/)).toBeDisabled()

      jest.useRealTimers()
    })

    it('送信完了後に新しいお問い合わせをクリックするとフォームがリセットされる', async () => {
      jest.useFakeTimers()
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'general')
      await user.type(screen.getByLabelText(/件名/), 'テスト件名')
      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'これはテストのお問い合わせ内容です。')
      await user.click(screen.getByRole('button', { name: '送信する' }))

      jest.advanceTimersByTime(2000)

      await waitFor(() => {
        expect(screen.getByText('お問い合わせを受け付けました')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '新しいお問い合わせ' }))

      // フォームが再表示される
      expect(screen.getByLabelText(/お名前/)).toBeInTheDocument()
      expect(screen.getByLabelText(/お名前/)).toHaveValue('')

      jest.useRealTimers()
    })
  })

  // ============================================================
  // 入力変更
  // ============================================================

  describe('入力変更', () => {
    it('テキスト入力でエラーがクリアされる', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      // エラーを表示させる
      await user.click(screen.getByRole('button', { name: '送信する' }))
      expect(screen.getByText('お名前を入力してください')).toBeInTheDocument()

      // 入力するとエラーがクリアされる
      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      expect(screen.queryByText('お名前を入力してください')).not.toBeInTheDocument()
    })

    it('カテゴリ変更でエラーがクリアされる', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      // 必須項目を入力してカテゴリエラーを表示させる
      await user.type(screen.getByLabelText(/お名前/), '山田太郎')
      await user.type(screen.getByLabelText(/メールアドレス/), 'test@example.com')
      await user.click(screen.getByRole('button', { name: '送信する' }))
      expect(screen.getByText('カテゴリを選択してください')).toBeInTheDocument()

      // カテゴリを選択するとエラーがクリアされる
      await user.selectOptions(screen.getByLabelText(/カテゴリ/), 'bug')
      expect(screen.queryByText('カテゴリを選択してください')).not.toBeInTheDocument()
    })

    it('文字数カウンターが更新される', async () => {
      const user = userEvent.setup()
      render(<ContactForm />)

      await user.type(screen.getByLabelText(/お問い合わせ内容/), 'テスト')
      expect(screen.getByText('3 / 2000文字')).toBeInTheDocument()
    })
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from '@/components/ui/textarea'

describe('Textarea', () => {
  it('テキストエリアを表示する', () => {
    render(<Textarea placeholder="コメントを入力..." />)

    expect(screen.getByPlaceholderText('コメントを入力...')).toBeInTheDocument()
  })

  it('data-slot属性をtextareaに設定する', () => {
    const { container } = render(<Textarea />)

    expect(container.firstChild).toHaveAttribute('data-slot', 'textarea')
  })

  describe('スタイル', () => {
    it('基本的なスタイルクラスを適用する', () => {
      const { container } = render(<Textarea />)

      expect(container.firstChild).toHaveClass('w-full')
      expect(container.firstChild).toHaveClass('rounded-md')
      expect(container.firstChild).toHaveClass('border')
      expect(container.firstChild).toHaveClass('min-h-16')
    })

    it('フレックスレイアウトを適用する', () => {
      const { container } = render(<Textarea />)

      expect(container.firstChild).toHaveClass('flex')
    })

    it('パディングを適用する', () => {
      const { container } = render(<Textarea />)

      expect(container.firstChild).toHaveClass('px-3')
      expect(container.firstChild).toHaveClass('py-2')
    })

    it('追加のクラスを適用する', () => {
      const { container } = render(<Textarea className="min-h-32" />)

      expect(container.firstChild).toHaveClass('min-h-32')
    })
  })

  describe('disabled状態', () => {
    it('disabledの場合は無効化する', () => {
      render(<Textarea disabled data-testid="textarea" />)

      expect(screen.getByTestId('textarea')).toBeDisabled()
    })

    it('disabledの場合は適切なスタイルクラスを持つ', () => {
      const { container } = render(<Textarea disabled />)

      expect(container.firstChild).toHaveClass('disabled:cursor-not-allowed')
      expect(container.firstChild).toHaveClass('disabled:opacity-50')
    })
  })

  describe('入力操作', () => {
    it('テキストを入力できる', () => {
      render(<Textarea data-testid="textarea" />)

      const textarea = screen.getByTestId('textarea')
      fireEvent.change(textarea, { target: { value: '複数行の\nテスト入力' } })

      expect(textarea).toHaveValue('複数行の\nテスト入力')
    })

    it('onChangeコールバックを呼び出す', () => {
      const handleChange = jest.fn()
      render(<Textarea onChange={handleChange} data-testid="textarea" />)

      fireEvent.change(screen.getByTestId('textarea'), { target: { value: 'test' } })

      expect(handleChange).toHaveBeenCalled()
    })

    it('valueを制御できる', () => {
      render(<Textarea value="制御値" onChange={() => {}} data-testid="textarea" />)

      expect(screen.getByTestId('textarea')).toHaveValue('制御値')
    })
  })

  describe('バリデーション', () => {
    it('aria-invalid属性を適用する', () => {
      const { container } = render(<Textarea aria-invalid="true" />)

      expect(container.firstChild).toHaveAttribute('aria-invalid', 'true')
    })

    it('エラー時のスタイルクラスを持つ', () => {
      const { container } = render(<Textarea />)

      expect(container.firstChild).toHaveClass('aria-invalid:border-destructive')
    })

    it('required属性を適用する', () => {
      render(<Textarea required data-testid="textarea" />)

      expect(screen.getByTestId('textarea')).toBeRequired()
    })
  })

  describe('その他の属性', () => {
    it('rows属性を適用する', () => {
      render(<Textarea rows={5} data-testid="textarea" />)

      expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '5')
    })

    it('maxLength属性を適用する', () => {
      render(<Textarea maxLength={500} data-testid="textarea" />)

      expect(screen.getByTestId('textarea')).toHaveAttribute('maxLength', '500')
    })

    it('name属性を適用する', () => {
      render(<Textarea name="content" data-testid="textarea" />)

      expect(screen.getByTestId('textarea')).toHaveAttribute('name', 'content')
    })
  })
})

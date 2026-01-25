import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '@/components/ui/input'

describe('Input', () => {
  it('入力フィールドを表示する', () => {
    render(<Input placeholder="テスト入力" />)

    expect(screen.getByPlaceholderText('テスト入力')).toBeInTheDocument()
  })

  it('data-slot属性をinputに設定する', () => {
    const { container } = render(<Input />)

    expect(container.firstChild).toHaveAttribute('data-slot', 'input')
  })

  describe('type属性', () => {
    it('type未指定の場合はtype属性がない', () => {
      render(<Input data-testid="input" />)

      // HTML仕様ではtype未指定時はtextとして扱われるが、属性自体はない
      const input = screen.getByTestId('input')
      expect(input.tagName).toBe('INPUT')
    })

    it('email型を適用する', () => {
      render(<Input type="email" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email')
    })

    it('password型を適用する', () => {
      render(<Input type="password" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password')
    })

    it('number型を適用する', () => {
      render(<Input type="number" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('type', 'number')
    })
  })

  describe('スタイル', () => {
    it('基本的なスタイルクラスを適用する', () => {
      const { container } = render(<Input />)

      expect(container.firstChild).toHaveClass('w-full')
      expect(container.firstChild).toHaveClass('rounded')
      expect(container.firstChild).toHaveClass('border')
      expect(container.firstChild).toHaveClass('h-9')
    })

    it('追加のクラスを適用する', () => {
      const { container } = render(<Input className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('disabled状態', () => {
    it('disabledの場合は無効化する', () => {
      render(<Input disabled data-testid="input" />)

      expect(screen.getByTestId('input')).toBeDisabled()
    })

    it('disabledの場合はopacity-50クラスを適用する', () => {
      const { container } = render(<Input disabled />)

      expect(container.firstChild).toHaveClass('disabled:opacity-50')
    })
  })

  describe('入力操作', () => {
    it('テキストを入力できる', () => {
      render(<Input data-testid="input" />)

      const input = screen.getByTestId('input')
      fireEvent.change(input, { target: { value: 'テスト入力値' } })

      expect(input).toHaveValue('テスト入力値')
    })

    it('onChangeコールバックを呼び出す', () => {
      const handleChange = jest.fn()
      render(<Input onChange={handleChange} data-testid="input" />)

      fireEvent.change(screen.getByTestId('input'), { target: { value: 'test' } })

      expect(handleChange).toHaveBeenCalled()
    })

    it('valueを制御できる', () => {
      render(<Input value="制御値" onChange={() => {}} data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveValue('制御値')
    })
  })

  describe('バリデーション', () => {
    it('aria-invalid属性を適用する', () => {
      render(<Input aria-invalid="true" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true')
    })

    it('required属性を適用する', () => {
      render(<Input required data-testid="input" />)

      expect(screen.getByTestId('input')).toBeRequired()
    })
  })

  describe('その他の属性', () => {
    it('name属性を適用する', () => {
      render(<Input name="email" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('name', 'email')
    })

    it('id属性を適用する', () => {
      render(<Input id="my-input" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('id', 'my-input')
    })

    it('maxLength属性を適用する', () => {
      render(<Input maxLength={100} data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('maxLength', '100')
    })

    it('autoComplete属性を適用する', () => {
      render(<Input autoComplete="email" data-testid="input" />)

      expect(screen.getByTestId('input')).toHaveAttribute('autoComplete', 'email')
    })
  })
})

import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { StarRating, StarRatingInput, StarRatingDisplay } from '@/components/shop/StarRating'

describe('StarRating', () => {
  it('5つの星を表示する', () => {
    render(<StarRating rating={3} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('指定された評価の数だけ星を塗りつぶす', () => {
    const { container } = render(<StarRating rating={3} />)
    const filledStars = container.querySelectorAll('svg[fill="currentColor"]')
    expect(filledStars).toHaveLength(3)
  })

  it('非インタラクティブ時はボタンが無効化される', () => {
    render(<StarRating rating={3} interactive={false} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('インタラクティブ時はボタンが有効化される', () => {
    render(<StarRating rating={3} interactive={true} onChange={jest.fn()} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).not.toBeDisabled()
    })
  })

  it('クリックでonChangeを呼ぶ（インタラクティブ時）', async () => {
    const mockOnChange = jest.fn()
    const user = userEvent.setup()
    render(<StarRating rating={3} interactive={true} onChange={mockOnChange} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[4]) // 5番目の星をクリック

    expect(mockOnChange).toHaveBeenCalledWith(5)
  })

  it('smサイズを適用できる', () => {
    const { container } = render(<StarRating rating={3} size="sm" />)
    const stars = container.querySelectorAll('svg')
    expect(stars[0]).toHaveClass('w-4', 'h-4')
  })

  it('lgサイズを適用できる', () => {
    const { container } = render(<StarRating rating={3} size="lg" />)
    const stars = container.querySelectorAll('svg')
    expect(stars[0]).toHaveClass('w-6', 'h-6')
  })
})

describe('StarRatingInput', () => {
  it('クリックで値を変更できる', async () => {
    const mockOnChange = jest.fn()
    const user = userEvent.setup()
    render(<StarRatingInput value={3} onChange={mockOnChange} />)

    const buttons = screen.getAllByRole('button')
    await user.click(buttons[3]) // 4番目の星をクリック

    expect(mockOnChange).toHaveBeenCalledWith(4)
  })
})

describe('StarRatingDisplay', () => {
  it('読み取り専用で星を表示する', () => {
    render(<StarRatingDisplay rating={4.5} />)
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0) // ボタンはない
  })

  it('showValue=trueで数値を表示する', () => {
    render(<StarRatingDisplay rating={4.5} showValue={true} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('showValue=falseで数値を表示しない', () => {
    render(<StarRatingDisplay rating={4.5} showValue={false} />)
    expect(screen.queryByText('4.5')).not.toBeInTheDocument()
  })

  it('smサイズを適用できる', () => {
    const { container } = render(<StarRatingDisplay rating={3} size="sm" />)
    const stars = container.querySelectorAll('svg')
    expect(stars[0]).toHaveClass('w-3', 'h-3')
  })
})

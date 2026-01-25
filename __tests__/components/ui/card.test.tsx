import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card'

describe('Card', () => {
  it('子要素を表示する', () => {
    render(
      <Card>
        <div data-testid="child">Child Content</div>
      </Card>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('data-slot属性をcardに設定する', () => {
    const { container } = render(<Card>Content</Card>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card')
  })

  it('基本的なスタイルクラスを適用する', () => {
    const { container } = render(<Card>Content</Card>)

    expect(container.firstChild).toHaveClass('bg-card/95')
    expect(container.firstChild).toHaveClass('rounded')
    expect(container.firstChild).toHaveClass('border')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CardHeader', () => {
  it('子要素を表示する', () => {
    render(
      <CardHeader>
        <div data-testid="header-child">Header Content</div>
      </CardHeader>
    )

    expect(screen.getByTestId('header-child')).toBeInTheDocument()
  })

  it('data-slot属性をcard-headerに設定する', () => {
    const { container } = render(<CardHeader>Header</CardHeader>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card-header')
  })

  it('基本的なスタイルクラスを適用する', () => {
    const { container } = render(<CardHeader>Header</CardHeader>)

    expect(container.firstChild).toHaveClass('grid')
    expect(container.firstChild).toHaveClass('px-6')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<CardHeader className="custom-class">Header</CardHeader>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CardTitle', () => {
  it('タイトルテキストを表示する', () => {
    render(<CardTitle>Card Title</CardTitle>)

    expect(screen.getByText('Card Title')).toBeInTheDocument()
  })

  it('data-slot属性をcard-titleに設定する', () => {
    const { container } = render(<CardTitle>Title</CardTitle>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card-title')
  })

  it('タイトルスタイルを適用する', () => {
    const { container } = render(<CardTitle>Title</CardTitle>)

    expect(container.firstChild).toHaveClass('font-semibold')
    expect(container.firstChild).toHaveClass('leading-none')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<CardTitle className="custom-class">Title</CardTitle>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CardDescription', () => {
  it('説明テキストを表示する', () => {
    render(<CardDescription>Card Description</CardDescription>)

    expect(screen.getByText('Card Description')).toBeInTheDocument()
  })

  it('data-slot属性をcard-descriptionに設定する', () => {
    const { container } = render(<CardDescription>Description</CardDescription>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card-description')
  })

  it('説明文スタイルを適用する', () => {
    const { container } = render(<CardDescription>Description</CardDescription>)

    expect(container.firstChild).toHaveClass('text-muted-foreground')
    expect(container.firstChild).toHaveClass('text-sm')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<CardDescription className="custom-class">Description</CardDescription>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CardContent', () => {
  it('コンテンツを表示する', () => {
    render(
      <CardContent>
        <p>Main Content</p>
      </CardContent>
    )

    expect(screen.getByText('Main Content')).toBeInTheDocument()
  })

  it('data-slot属性をcard-contentに設定する', () => {
    const { container } = render(<CardContent>Content</CardContent>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card-content')
  })

  it('コンテンツスタイルを適用する', () => {
    const { container } = render(<CardContent>Content</CardContent>)

    expect(container.firstChild).toHaveClass('px-6')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<CardContent className="custom-class">Content</CardContent>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CardFooter', () => {
  it('フッター内容を表示する', () => {
    render(
      <CardFooter>
        <button>Action</button>
      </CardFooter>
    )

    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('data-slot属性をcard-footerに設定する', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card-footer')
  })

  it('フッタースタイルを適用する', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>)

    expect(container.firstChild).toHaveClass('flex')
    expect(container.firstChild).toHaveClass('items-center')
    expect(container.firstChild).toHaveClass('px-6')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<CardFooter className="custom-class">Footer</CardFooter>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('CardAction', () => {
  it('アクションボタンを表示する', () => {
    render(
      <CardAction>
        <button>Edit</button>
      </CardAction>
    )

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('data-slot属性をcard-actionに設定する', () => {
    const { container } = render(<CardAction>Action</CardAction>)

    expect(container.firstChild).toHaveAttribute('data-slot', 'card-action')
  })

  it('アクションスタイルを適用する', () => {
    const { container } = render(<CardAction>Action</CardAction>)

    expect(container.firstChild).toHaveClass('col-start-2')
    expect(container.firstChild).toHaveClass('row-span-2')
    expect(container.firstChild).toHaveClass('justify-self-end')
  })

  it('追加のクラスを適用する', () => {
    const { container } = render(<CardAction className="custom-class">Action</CardAction>)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('Card完全な構成', () => {
  it('すべてのパーツを組み合わせて表示する', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>テストカード</CardTitle>
          <CardDescription>これは説明文です</CardDescription>
          <CardAction>
            <button>編集</button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p>メインコンテンツ</p>
        </CardContent>
        <CardFooter>
          <button>アクション</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByText('テストカード')).toBeInTheDocument()
    expect(screen.getByText('これは説明文です')).toBeInTheDocument()
    expect(screen.getByText('メインコンテンツ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アクション' })).toBeInTheDocument()
  })
})

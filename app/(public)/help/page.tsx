/**
 * @file app/(public)/help/page.tsx
 * @description BON-LOGヘルプセンターページ
 *
 * このページはBON-LOGの使い方やよくある質問（FAQ）を表示します。
 * ユーザーがサービスを利用する際の疑問を解決するためのページです。
 *
 * 主な機能:
 * - FAQセクション（アコーディオン形式で質問と回答を表示）
 * - クイックリンク（関連ページへの導線）
 * - お問い合わせフォーム
 *
 * FAQカテゴリ:
 * - はじめに（サービス概要、アカウント作成）
 * - 投稿について（文字数制限、画像・動画、ジャンル）
 * - プレミアム会員（特典、料金、支払い、解約）
 * - プライバシーとセキュリティ（非公開設定、ブロック、ミュート）
 * - 盆栽園マップ（登録、編集、レビュー）
 * - その他（報告、お問い合わせ、アプリ）
 */

// Next.jsのメタデータ型定義（SEO対策用）
import { Metadata } from 'next'
// Next.jsのクライアントサイドナビゲーション用Linkコンポーネント
import Link from 'next/link'

/**
 * ページメタデータの定義
 * SEO最適化のためのtitleとdescriptionを設定
 */
export const metadata: Metadata = {
  title: 'ヘルプ - BON-LOG',
  description: 'BON-LOG（ボンログ）のヘルプページです。',
}

/**
 * 右矢印アイコンコンポーネント
 * リンクやアコーディオンの展開状態を示すために使用
 *
 * @param className - アイコンに適用するCSSクラス名
 * @returns SVGアイコン要素
 */
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}

/**
 * 検索アイコンコンポーネント
 * 検索入力フィールドに表示
 *
 * @param className - アイコンに適用するCSSクラス名
 * @returns SVGアイコン要素
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

/**
 * ヘルプセクションの型定義
 * FAQのカテゴリごとにタイトルと質問・回答のリストを持つ
 */
interface HelpSection {
  /** セクションのタイトル（カテゴリ名） */
  title: string
  /** 質問と回答のリスト */
  items: {
    /** 質問文 */
    question: string
    /** 回答文 */
    answer: string
  }[]
}

/**
 * ヘルプセクションのデータ定義
 * 各カテゴリごとにFAQを整理
 */
const helpSections: HelpSection[] = [
  // 「はじめに」セクション: サービスの基本的な使い方
  {
    title: 'はじめに',
    items: [
      {
        question: 'BON-LOGとは何ですか？',
        answer: 'BON-LOGは、盆栽愛好家のためのSNSプラットフォームです。盆栽の写真や情報を投稿・共有したり、他の愛好家と交流したり、盆栽園を探したりすることができます。',
      },
      {
        question: 'アカウントの作成方法は？',
        answer: 'トップページの「新規登録」ボタンから、メールアドレスとパスワードを入力してアカウントを作成できます。登録後、メールアドレスの確認が必要です。',
      },
      {
        question: 'ログインできない場合は？',
        answer: 'パスワードを忘れた場合は、ログイン画面の「パスワードをお忘れですか？」からパスワードリセットを行ってください。メールアドレスが間違っている場合は、登録時のメールアドレスをご確認ください。',
      },
    ],
  },
  // 「投稿について」セクション: 投稿機能の詳細
  {
    title: '投稿について',
    items: [
      {
        question: '投稿の文字数制限は？',
        answer: '無料会員は500文字まで、有料会員（プレミアム）は2000文字まで投稿できます。',
      },
      {
        question: '画像や動画は何枚まで添付できますか？',
        answer: '無料会員は画像4枚または動画2本まで、有料会員は画像6枚または動画3本まで添付できます。画像と動画は組み合わせて添付することも可能です。',
      },
      {
        question: '1日に何件まで投稿できますか？',
        answer: '投稿は1日20件まで、コメントは1日100件までです。これはスパム防止のための制限です。',
      },
      {
        question: '投稿を削除するには？',
        answer: '自分の投稿の右上にあるメニュー（...）から「削除」を選択してください。削除した投稿は復元できません。',
      },
      {
        question: 'ジャンルとは何ですか？',
        answer: 'ジャンルは投稿のカテゴリーです。「松柏類」「雑木類」「道具」など、投稿内容に合ったジャンルを最大3つまで選択できます。ジャンルを設定すると、興味のあるユーザーに発見されやすくなります。',
      },
    ],
  },
  // 「プレミアム会員」セクション: 有料会員に関する情報
  {
    title: 'プレミアム会員',
    items: [
      {
        question: 'プレミアム会員の特典は？',
        answer: 'プレミアム会員になると、以下の特典があります：\n・投稿文字数が2000文字に拡大\n・画像6枚、動画3本まで添付可能\n・予約投稿機能\n・投稿分析機能（いいね数、引用数、キーワード分析）\n・プレミアムバッジの表示',
      },
      {
        question: '料金はいくらですか？',
        answer: '料金プランについては、設定画面の「プレミアム会員」からご確認ください。月額プランと年額プラン（お得）をご用意しています。',
      },
      {
        question: '支払い方法は？',
        answer: 'クレジットカード（Visa、Mastercard、American Express、JCB）でお支払いいただけます。決済は安全な決済代行会社（Stripe）を通じて処理されます。',
      },
      {
        question: '解約方法は？',
        answer: '設定画面の「サブスクリプション管理」からいつでも解約できます。解約しても、契約期間の終了日まではプレミアム機能をご利用いただけます。',
      },
      {
        question: '返金はありますか？',
        answer: '契約期間の途中で解約した場合、日割り計算による返金は行っておりません。ただし、当方の責に帰すべき事由によりサービスが提供できなかった場合は、返金対応いたします。',
      },
      {
        question: '無料トライアルはありますか？',
        answer: '新規のお客様には、無料トライアル期間を設けている場合があります。詳細は料金ページをご確認ください。トライアル期間中に解約した場合、料金は発生しません。',
      },
    ],
  },
  // 「プライバシーとセキュリティ」セクション: アカウント保護に関する情報
  {
    title: 'プライバシーとセキュリティ',
    items: [
      {
        question: 'アカウントを非公開にするには？',
        answer: '設定画面の「プライバシー」から、アカウントを非公開に設定できます。非公開アカウントの投稿は、承認したフォロワーのみが閲覧できます。',
      },
      {
        question: '特定のユーザーをブロックするには？',
        answer: 'ブロックしたいユーザーのプロフィールページで、メニューから「ブロック」を選択してください。ブロックしたユーザーは、あなたの投稿を閲覧できなくなります。',
      },
      {
        question: 'ミュート機能とは？',
        answer: 'ミュートすると、そのユーザーの投稿がタイムラインに表示されなくなります。ブロックとは異なり、相手はあなたの投稿を引き続き閲覧できます。',
      },
      {
        question: 'パスワードを変更するには？',
        answer: '設定画面の「アカウント」から、現在のパスワードと新しいパスワードを入力して変更できます。',
      },
      {
        question: 'アカウントを削除するには？',
        answer: '設定画面の「アカウント」から、アカウントの削除を申請できます。削除すると、すべての投稿、コメント、いいねなどのデータが完全に削除され、復元できません。有料会員の場合は、事前に解約手続きを行ってください。',
      },
    ],
  },
  // 「盆栽園マップ」セクション: マップ機能に関する情報
  {
    title: '盆栽園マップ',
    items: [
      {
        question: '盆栽園を登録するには？',
        answer: '盆栽園マップページの「盆栽園を登録」ボタンから、盆栽園の情報を入力して登録できます。住所を入力すると、自動的に地図上の位置が設定されます。',
      },
      {
        question: '登録した盆栽園の情報を編集するには？',
        answer: '自分が登録した盆栽園の詳細ページで、「編集」ボタンをクリックして情報を更新できます。他のユーザーが登録した盆栽園は編集できません。',
      },
      {
        question: 'レビューを投稿するには？',
        answer: '盆栽園の詳細ページで、星評価（1〜5）とコメントを入力してレビューを投稿できます。同じ盆栽園に複数のレビューを投稿することはできません。',
      },
      {
        question: '現在地から近い盆栽園を探すには？',
        answer: '盆栽園マップで、現在地ボタンをクリックすると、あなたの現在地に地図が移動します。位置情報の利用を許可する必要があります。',
      },
    ],
  },
  // 「その他」セクション: その他の質問
  {
    title: 'その他',
    items: [
      {
        question: '不適切なコンテンツを報告するには？',
        answer: '投稿やコメントの右上にあるメニュー（...）から「報告」を選択し、報告理由を選んで送信してください。報告は匿名で処理されます。',
      },
      {
        question: 'お問い合わせ方法は？',
        answer: '本ページ下部のお問い合わせフォームからご連絡ください。通常、3営業日以内に回答いたします。',
      },
      {
        question: 'アプリはありますか？',
        answer: '現在、BON-LOGはWebブラウザからのみご利用いただけます。スマートフォンでもブラウザから快適にご利用いただけるよう最適化されています。',
      },
    ],
  },
]

/**
 * ヘルプセンターページコンポーネント
 *
 * FAQをカテゴリごとにアコーディオン形式で表示し、
 * ユーザーが疑問を解決できるようにします。
 * また、お問い合わせフォームを提供し、FAQで解決しない問題に対応します。
 *
 * @returns ヘルプセンターページ要素
 */
export default function HelpPage() {
  return (
    <div className="space-y-8">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-3xl font-bold mb-2">ヘルプセンター</h1>
        <p className="text-muted-foreground">
          BON-LOGの使い方や、よくあるご質問についてご案内します。
        </p>
      </div>

      {/* 検索フィールド（将来的に実装予定、現在は無効） */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="キーワードで検索..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          disabled
        />
      </div>

      {/* クイックリンク: よく使われるページへの導線 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* プレミアム会員セクションへのページ内リンク */}
        <Link
          href="#premium"
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">プレミアム会員について</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
        {/* 利用規約ページへのリンク */}
        <Link
          href="/terms"
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">利用規約</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
        {/* プライバシーポリシーページへのリンク */}
        <Link
          href="/privacy"
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">プライバシーポリシー</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
      </div>

      {/* FAQ セクション: カテゴリごとに質問と回答を表示 */}
      <div className="space-y-8">
        {helpSections.map((section, sectionIndex) => (
          <section
            key={sectionIndex}
            // プレミアム会員セクションにはアンカーIDを設定
            id={section.title === 'プレミアム会員' ? 'premium' : undefined}
            className="scroll-mt-8"
          >
            {/* セクションタイトル */}
            <h2 className="text-xl font-bold mb-4 pb-2 border-b">{section.title}</h2>
            {/* 質問リスト（アコーディオン形式） */}
            <div className="space-y-4">
              {section.items.map((item, itemIndex) => (
                // HTML5のdetails/summary要素でアコーディオンを実装
                <details
                  key={itemIndex}
                  className="group bg-card border rounded-lg"
                >
                  {/* 質問（クリックで開閉） */}
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-muted/50 rounded-lg">
                    <span className="font-medium pr-4">{item.question}</span>
                    {/* 開閉状態を示すアイコン（開くと90度回転） */}
                    <ChevronRightIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-90" />
                  </summary>
                  {/* 回答（展開時に表示） */}
                  <div className="px-4 pb-4 text-muted-foreground whitespace-pre-line">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* お問い合わせセクション: FAQで解決しない場合の連絡先 */}
      <section className="bg-muted/50 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-2">お探しの答えが見つかりませんか？</h2>
        <p className="text-muted-foreground mb-4">
          ヘルプセンターで解決しない場合は、お問い合わせフォームからご連絡ください。
        </p>
        {/* お問い合わせフォーム */}
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">お問い合わせフォーム</h3>
          <form className="space-y-4">
            {/* メールアドレス入力 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="your@email.com"
              />
            </div>
            {/* お問い合わせ種類の選択 */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-1">
                お問い合わせ種類
              </label>
              <select
                id="category"
                name="category"
                required
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">選択してください</option>
                <option value="account">アカウントについて</option>
                <option value="premium">プレミアム会員・決済について</option>
                <option value="feature">機能の使い方</option>
                <option value="bug">不具合の報告</option>
                <option value="report">不適切なコンテンツの報告</option>
                <option value="other">その他</option>
              </select>
            </div>
            {/* お問い合わせ内容の入力 */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-1">
                お問い合わせ内容
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="お問い合わせ内容を詳しくご記入ください..."
              />
            </div>
            {/* 送信ボタン */}
            <button
              type="submit"
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              送信する
            </button>
          </form>
          {/* 返信についての注意書き */}
          <p className="text-xs text-muted-foreground mt-4">
            ※ 通常、3営業日以内にご返信いたします。
          </p>
        </div>
      </section>
    </div>
  )
}

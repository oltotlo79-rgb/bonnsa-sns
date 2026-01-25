/**
 * @fileoverview アナログ時計型タイムピッカーコンポーネント
 *
 * @description
 * アナログ時計のインターフェースで時刻を選択できるコンポーネントです。
 * マウスドラッグやタッチ操作で直感的に時刻を設定できます。
 * 24時間制に対応し、時（外側リングAM、内側リングPM）と分を
 * 順番に選択する2段階UIを提供します。
 *
 * @features
 * - 24時間制表示（AM: 0-11, PM: 12-23）
 * - マウスドラッグ対応
 * - タッチデバイス対応
 * - 時間選択後に自動的に分選択へ遷移
 * - ドロップダウン形式のポップアップ
 * - 無効状態対応
 *
 * @example
 * // 基本的な使用例
 * const [time, setTime] = useState('09:00')
 * <AnalogClockPicker value={time} onChange={setTime} />
 *
 * @example
 * // ラベル付き
 * <AnalogClockPicker
 *   value={startTime}
 *   onChange={setStartTime}
 *   label="開始時刻"
 * />
 *
 * @example
 * // フォーム内で無効化
 * <AnalogClockPicker
 *   value={time}
 *   onChange={setTime}
 *   disabled={isSubmitting}
 * />
 */

'use client'

// Reactのフック類
// useState: コンポーネントの状態管理
// useRef: DOM要素への参照とミュータブルな値の保持
// useCallback: 関数のメモ化（依存配列が変更されない限り同じ関数を返す）
// useEffect: 副作用の処理（外部クリック検出など）
import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * AnalogClockPickerのプロパティ型定義
 */
interface AnalogClockPickerProps {
  /** 現在の時刻値（"HH:MM"形式の文字列） */
  value: string
  /** 時刻変更時に呼び出されるコールバック関数 */
  onChange: (value: string) => void
  /** 入力フィールドのラベル（任意） */
  label?: string
  /** コンポーネントを無効化するかどうか */
  disabled?: boolean
}

/**
 * 時計のモード型定義
 * hours: 時間選択モード
 * minutes: 分選択モード
 */
type ClockMode = 'hours' | 'minutes'

/**
 * アナログ時計型タイムピッカーコンポーネント
 *
 * 時刻をアナログ時計のインターフェースで選択するためのUIコンポーネントです。
 * イベント開始/終了時刻の設定など、直感的な時刻入力が必要な場面で使用します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.value - 現在の時刻値（"HH:MM"形式）
 * @param props.onChange - 時刻変更時のコールバック
 * @param props.label - 入力フィールドのラベル
 * @param props.disabled - 無効状態
 *
 * @returns アナログ時計ピッカーをレンダリングするReactコンポーネント
 */
export function AnalogClockPicker({
  value,
  onChange,
  label,
  disabled = false,
}: AnalogClockPickerProps) {
  // ドロップダウンの開閉状態
  const [isOpen, setIsOpen] = useState(false)
  // 現在のモード（時間選択 or 分選択）
  const [mode, setMode] = useState<ClockMode>('hours')
  // 時計の文字盤要素への参照
  const clockRef = useRef<HTMLDivElement>(null)
  // コンポーネント全体のコンテナへの参照
  const containerRef = useRef<HTMLDivElement>(null)

  /**
   * 時刻文字列をパースして時・分に分解する
   *
   * @param timeStr - "HH:MM"形式の時刻文字列
   * @returns 時と分を含むオブジェクト
   */
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const [h, m] = timeStr.split(':').map(Number)
    return {
      // 無効な値の場合はデフォルト値（9時）を使用
      hours: isNaN(h) ? 9 : h,
      // 無効な値の場合はデフォルト値（0分）を使用
      minutes: isNaN(m) ? 0 : m,
    }
  }

  // 現在の時・分の値を取得
  const { hours, minutes } = parseTime(value)

  /**
   * 時・分を時刻文字列にフォーマットする
   *
   * @param h - 時（0-23）
   * @param m - 分（0-59）
   * @returns "HH:MM"形式の時刻文字列
   */
  const formatTime = (h: number, m: number): string => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  /**
   * 外側クリック検出
   * ピッカーの外側をクリックした場合に閉じる
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setMode('hours')
      }
    }

    // ピッカーが開いている場合のみイベントリスナーを登録
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    // クリーンアップ関数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  /**
   * 時計の中心からクリック位置への角度を計算する
   *
   * @param clientX - クリック位置のX座標
   * @param clientY - クリック位置のY座標
   * @returns 角度（0度 = 12時の位置、時計回りで増加）
   */
  const getAngleFromCenter = useCallback((clientX: number, clientY: number): number => {
    if (!clockRef.current) return 0

    // 時計の文字盤の位置とサイズを取得
    const rect = clockRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // 中心からのオフセットを計算
    const deltaX = clientX - centerX
    const deltaY = clientY - centerY

    // 角度を計算（0 = 12時の位置、時計回り）
    let angle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI)
    // 負の角度を正に変換（-180〜180 → 0〜360）
    if (angle < 0) angle += 360

    return angle
  }, [])

  /**
   * 時計のクリック/ドラッグ操作を処理する
   *
   * @param clientX - 操作位置のX座標
   * @param clientY - 操作位置のY座標
   * @param isEnd - 操作終了（マウスアップ/タッチエンド）かどうか
   */
  const handleClockInteraction = useCallback(
    (clientX: number, clientY: number, isEnd: boolean = false) => {
      const angle = getAngleFromCenter(clientX, clientY)

      if (mode === 'hours') {
        // 時間選択モード: 30度ごとに1時間（360 / 12 = 30）
        let newHours = Math.round(angle / 30) % 12

        // 内側リング（PM）か外側リング（AM）かを判定
        if (clockRef.current) {
          const rect = clockRef.current.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          // 中心からの距離を計算
          const distance = Math.sqrt(
            Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
          )
          const radius = rect.width / 2

          // 内側リング = PM（12-23）、外側リング = AM（0-11）
          if (distance < radius * 0.55) {
            // 内側リング（PM）: 12〜23時
            newHours = newHours === 0 ? 12 : newHours + 12
          } else {
            // 外側リング（AM）: 0〜11時
            newHours = newHours === 0 ? 0 : newHours
          }
        }

        onChange(formatTime(newHours, minutes))

        // 操作終了時は分選択モードへ遷移
        if (isEnd) {
          setMode('minutes')
        }
      } else {
        // 分選択モード: 6度ごとに1分（360 / 60 = 6）
        const newMinutes = Math.round(angle / 6) % 60
        onChange(formatTime(hours, newMinutes))

        // 操作終了時はピッカーを閉じる
        if (isEnd) {
          setIsOpen(false)
          setMode('hours')
        }
      }
    },
    [mode, hours, minutes, onChange, getAngleFromCenter]
  )

  // === マウスイベントハンドラー ===

  /**
   * マウスボタン押下時の処理
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    handleClockInteraction(e.clientX, e.clientY)
  }

  /**
   * マウス移動時の処理（ドラッグ中のみ）
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    // 無効化時、または左ボタンが押されていない場合は無視
    if (disabled || e.buttons !== 1) return
    handleClockInteraction(e.clientX, e.clientY)
  }

  /**
   * マウスボタン解放時の処理
   */
  const handleMouseUp = (e: React.MouseEvent) => {
    if (disabled) return
    handleClockInteraction(e.clientX, e.clientY, true)
  }

  // === タッチイベントハンドラー ===

  /**
   * タッチ開始時の処理
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.touches[0]
    handleClockInteraction(touch.clientX, touch.clientY)
  }

  /**
   * タッチ移動時の処理
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.touches[0]
    handleClockInteraction(touch.clientX, touch.clientY)
  }

  /**
   * タッチ終了時の処理
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return
    const touch = e.changedTouches[0]
    handleClockInteraction(touch.clientX, touch.clientY, true)
  }

  /**
   * 時間選択用の数字を描画する
   *
   * 外側リング（AM: 12, 1-11）と内側リング（PM: 0, 13-23）の
   * 2重リングで24時間を表現します。
   *
   * @returns 時間数字のJSX要素
   */
  const renderHourNumbers = () => {
    // 外側リング: 12時、1時〜11時（AM相当）
    const outerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    // 内側リング: 0時、13時〜23時（PM相当と深夜0時）
    const innerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]

    return (
      <>
        {/* 外側リング（AM / 12時間制の時間） */}
        {outerHours.map((hour, index) => {
          // 12時の位置を0度とし、時計回りに30度ずつ
          // -90度のオフセットは、数学的な角度（3時 = 0度）からの調整
          const angle = (index * 30 - 90) * (Math.PI / 180)
          // 半径38%の位置に配置
          const x = 50 + 38 * Math.cos(angle)
          const y = 50 + 38 * Math.sin(angle)
          // 現在選択されているかどうか
          const isSelected = hours === hour || (hour === 12 && hours === 0)

          return (
            <div
              key={`outer-${hour}`}
              className={`absolute w-8 h-8 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              style={{
                // 中心を要素の中央に合わせるためにオフセット
                left: `calc(${x}% - 16px)`,
                top: `calc(${y}% - 16px)`,
              }}
            >
              {/* 0時は"00"と表示 */}
              {hour === 0 ? '00' : hour}
            </div>
          )
        })}
        {/* 内側リング（PM / 12時間制の13-23時と0時） */}
        {innerHours.map((hour, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180)
          // 半径24%の位置に配置（外側より小さい）
          const x = 50 + 24 * Math.cos(angle)
          const y = 50 + 24 * Math.sin(angle)
          const isSelected = hours === hour

          return (
            <div
              key={`inner-${hour}`}
              className={`absolute w-7 h-7 flex items-center justify-center text-xs rounded-full transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
              style={{
                left: `calc(${x}% - 14px)`,
                top: `calc(${y}% - 14px)`,
              }}
            >
              {hour}
            </div>
          )
        })}
      </>
    )
  }

  /**
   * 分選択用の数字を描画する
   *
   * 5分刻みの目盛り（0, 5, 10, ..., 55）を円形に配置します。
   *
   * @returns 分数字のJSX要素
   */
  const renderMinuteNumbers = () => {
    // 5分刻みの目盛り
    const minuteMarks = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

    return minuteMarks.map((minute, index) => {
      // 12時の位置を0度とし、時計回りに30度ずつ（12個なので）
      const angle = (index * 30 - 90) * (Math.PI / 180)
      const x = 50 + 38 * Math.cos(angle)
      const y = 50 + 38 * Math.sin(angle)
      const isSelected = minutes === minute

      return (
        <div
          key={minute}
          className={`absolute w-8 h-8 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
          style={{
            left: `calc(${x}% - 16px)`,
            top: `calc(${y}% - 16px)`,
          }}
        >
          {/* 常に2桁表示（例: 00, 05, 10） */}
          {minute.toString().padStart(2, '0')}
        </div>
      )
    })
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* ラベル（任意） */}
      {label && (
        <label className="text-sm font-medium mb-1 block">{label}</label>
      )}

      {/* 時刻表示ボタン（クリックでピッカーを開く） */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border bg-background text-left focus:outline-none focus:ring-2 focus:ring-primary ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* 時計アイコン */}
          <ClockIcon className="w-4 h-4 text-muted-foreground" />
          {/* 現在の時刻、または未設定時のプレースホルダー */}
          <span>{value || '--:--'}</span>
        </div>
      </button>

      {/* 時計ピッカードロップダウン */}
      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-card border rounded-xl shadow-lg">
          {/* 時刻表示（時/分の切り替えボタン） */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {/* 時間表示ボタン */}
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={`text-3xl font-bold px-2 py-1 rounded transition-colors ${
                mode === 'hours'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {hours.toString().padStart(2, '0')}
            </button>
            {/* 区切り文字 */}
            <span className="text-3xl font-bold">:</span>
            {/* 分表示ボタン */}
            <button
              type="button"
              onClick={() => setMode('minutes')}
              className={`text-3xl font-bold px-2 py-1 rounded transition-colors ${
                mode === 'minutes'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {minutes.toString().padStart(2, '0')}
            </button>
          </div>

          {/* 時計の文字盤 */}
          <div
            ref={clockRef}
            className="relative w-56 h-56 rounded-full bg-muted/50 border-2 select-none"
            // マウスイベント
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            // タッチイベント
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* 中心の点 */}
            <div className="absolute top-1/2 left-1/2 w-2 h-2 -mt-1 -ml-1 bg-primary rounded-full z-10" />

            {/* 数字（モードに応じて時間または分を表示） */}
            {mode === 'hours' ? renderHourNumbers() : renderMinuteNumbers()}
          </div>

          {/* アクションボタン */}
          <div className="flex justify-end gap-2 mt-4">
            {/* キャンセルボタン */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setMode('hours')
              }}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
            >
              キャンセル
            </button>
            {/* OKボタン */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setMode('hours')
              }}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 時計アイコンコンポーネント
 *
 * シンプルなSVG時計アイコンを表示します。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* 時計の外枠（円） */}
      <circle cx="12" cy="12" r="10" />
      {/* 時計の針 */}
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

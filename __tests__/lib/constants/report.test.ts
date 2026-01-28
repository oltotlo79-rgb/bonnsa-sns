/**
 * 通報機能の定数（report.ts）のテスト
 *
 * @jest-environment node
 */

import {
  REPORT_REASONS,
  AUTO_HIDE_THRESHOLD,
  TARGET_TYPE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  type ReportReason,
  type ReportTargetType,
  type ReportStatus,
  type ContentType,
} from '@/lib/constants/report'

describe('Report Constants', () => {
  // ============================================================
  // REPORT_REASONS
  // ============================================================

  describe('REPORT_REASONS', () => {
    it('5つの通報理由が定義されている', () => {
      expect(REPORT_REASONS).toHaveLength(5)
    })

    it('各理由にvalueとlabelが含まれている', () => {
      REPORT_REASONS.forEach((reason) => {
        expect(reason).toHaveProperty('value')
        expect(reason).toHaveProperty('label')
        expect(typeof reason.value).toBe('string')
        expect(typeof reason.label).toBe('string')
      })
    })

    it('spamが含まれている', () => {
      const spam = REPORT_REASONS.find((r) => r.value === 'spam')
      expect(spam).toBeDefined()
      expect(spam?.label).toBe('スパム')
    })

    it('inappropriateが含まれている', () => {
      const inappropriate = REPORT_REASONS.find((r) => r.value === 'inappropriate')
      expect(inappropriate).toBeDefined()
      expect(inappropriate?.label).toBe('不適切な内容')
    })

    it('harassmentが含まれている', () => {
      const harassment = REPORT_REASONS.find((r) => r.value === 'harassment')
      expect(harassment).toBeDefined()
      expect(harassment?.label).toBe('誹謗中傷')
    })

    it('copyrightが含まれている', () => {
      const copyright = REPORT_REASONS.find((r) => r.value === 'copyright')
      expect(copyright).toBeDefined()
      expect(copyright?.label).toBe('著作権侵害')
    })

    it('otherが含まれている', () => {
      const other = REPORT_REASONS.find((r) => r.value === 'other')
      expect(other).toBeDefined()
      expect(other?.label).toBe('その他')
    })

    it('重複するvalueがない', () => {
      const values = REPORT_REASONS.map((r) => r.value)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)
    })

    it('空のvalue/labelがない', () => {
      REPORT_REASONS.forEach((reason) => {
        expect(reason.value.length).toBeGreaterThan(0)
        expect(reason.label.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================
  // ReportReason 型
  // ============================================================

  describe('ReportReason型', () => {
    it('有効なReportReason値', () => {
      const validReasons: ReportReason[] = [
        'spam',
        'inappropriate',
        'harassment',
        'copyright',
        'other',
      ]

      validReasons.forEach((reason) => {
        expect(REPORT_REASONS.some((r) => r.value === reason)).toBe(true)
      })
    })

    it('REPORT_REASONSのvalueと一致する', () => {
      const reasonValues = REPORT_REASONS.map((r) => r.value)
      expect(reasonValues).toContain('spam')
      expect(reasonValues).toContain('inappropriate')
      expect(reasonValues).toContain('harassment')
      expect(reasonValues).toContain('copyright')
      expect(reasonValues).toContain('other')
    })
  })

  // ============================================================
  // ReportTargetType 型
  // ============================================================

  describe('ReportTargetType型', () => {
    it('すべての対象タイプがTARGET_TYPE_LABELSに含まれている', () => {
      const targetTypes: ReportTargetType[] = [
        'post',
        'comment',
        'event',
        'shop',
        'review',
        'user',
      ]

      targetTypes.forEach((type) => {
        expect(TARGET_TYPE_LABELS[type]).toBeDefined()
      })
    })
  })

  // ============================================================
  // ReportStatus 型
  // ============================================================

  describe('ReportStatus型', () => {
    it('すべてのステータスが有効', () => {
      const validStatuses: ReportStatus[] = [
        'pending',
        'reviewed',
        'resolved',
        'dismissed',
        'auto_hidden',
      ]

      // 型チェックが通ることを確認
      expect(validStatuses).toHaveLength(5)
    })
  })

  // ============================================================
  // AUTO_HIDE_THRESHOLD
  // ============================================================

  describe('AUTO_HIDE_THRESHOLD', () => {
    it('10に設定されている', () => {
      expect(AUTO_HIDE_THRESHOLD).toBe(10)
    })

    it('正の整数である', () => {
      expect(Number.isInteger(AUTO_HIDE_THRESHOLD)).toBe(true)
      expect(AUTO_HIDE_THRESHOLD).toBeGreaterThan(0)
    })

    it('適切な範囲である（1〜100）', () => {
      expect(AUTO_HIDE_THRESHOLD).toBeGreaterThanOrEqual(1)
      expect(AUTO_HIDE_THRESHOLD).toBeLessThanOrEqual(100)
    })
  })

  // ============================================================
  // ContentType 型
  // ============================================================

  describe('ContentType型', () => {
    it('userを含まない', () => {
      const contentTypes: ContentType[] = ['post', 'comment', 'event', 'shop', 'review']

      expect(contentTypes).not.toContain('user')
      expect(contentTypes).toHaveLength(5)
    })

    it('すべてのContentTypeがCONTENT_TYPE_LABELSに含まれている', () => {
      const contentTypes: ContentType[] = ['post', 'comment', 'event', 'shop', 'review']

      contentTypes.forEach((type) => {
        expect(CONTENT_TYPE_LABELS[type]).toBeDefined()
      })
    })
  })

  // ============================================================
  // TARGET_TYPE_LABELS
  // ============================================================

  describe('TARGET_TYPE_LABELS', () => {
    it('6つのラベルが定義されている', () => {
      expect(Object.keys(TARGET_TYPE_LABELS)).toHaveLength(6)
    })

    it('postのラベルが正しい', () => {
      expect(TARGET_TYPE_LABELS.post).toBe('投稿')
    })

    it('commentのラベルが正しい', () => {
      expect(TARGET_TYPE_LABELS.comment).toBe('コメント')
    })

    it('eventのラベルが正しい', () => {
      expect(TARGET_TYPE_LABELS.event).toBe('イベント')
    })

    it('shopのラベルが正しい', () => {
      expect(TARGET_TYPE_LABELS.shop).toBe('盆栽園')
    })

    it('reviewのラベルが正しい', () => {
      expect(TARGET_TYPE_LABELS.review).toBe('レビュー')
    })

    it('userのラベルが正しい', () => {
      expect(TARGET_TYPE_LABELS.user).toBe('ユーザー')
    })

    it('すべてのラベルが日本語である', () => {
      Object.values(TARGET_TYPE_LABELS).forEach((label) => {
        // 日本語文字（ひらがな、カタカナ、漢字）を含む
        expect(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(label)).toBe(true)
      })
    })

    it('空のラベルがない', () => {
      Object.values(TARGET_TYPE_LABELS).forEach((label) => {
        expect(label.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================
  // CONTENT_TYPE_LABELS
  // ============================================================

  describe('CONTENT_TYPE_LABELS', () => {
    it('5つのラベルが定義されている（userを除く）', () => {
      expect(Object.keys(CONTENT_TYPE_LABELS)).toHaveLength(5)
    })

    it('TARGET_TYPE_LABELSからuserを除いたものと一致する', () => {
      const contentTypes: ContentType[] = ['post', 'comment', 'event', 'shop', 'review']

      contentTypes.forEach((type) => {
        expect(CONTENT_TYPE_LABELS[type]).toBe(TARGET_TYPE_LABELS[type])
      })
    })

    it('userキーを含まない', () => {
      expect('user' in CONTENT_TYPE_LABELS).toBe(false)
    })
  })

  // ============================================================
  // CONTENT_TYPE_COLORS
  // ============================================================

  describe('CONTENT_TYPE_COLORS', () => {
    it('5つのカラーが定義されている', () => {
      expect(Object.keys(CONTENT_TYPE_COLORS)).toHaveLength(5)
    })

    it('postのカラーが正しい', () => {
      expect(CONTENT_TYPE_COLORS.post).toBe('bg-blue-100 text-blue-800')
    })

    it('commentのカラーが正しい', () => {
      expect(CONTENT_TYPE_COLORS.comment).toBe('bg-green-100 text-green-800')
    })

    it('eventのカラーが正しい', () => {
      expect(CONTENT_TYPE_COLORS.event).toBe('bg-purple-100 text-purple-800')
    })

    it('shopのカラーが正しい', () => {
      expect(CONTENT_TYPE_COLORS.shop).toBe('bg-amber-100 text-amber-800')
    })

    it('reviewのカラーが正しい', () => {
      expect(CONTENT_TYPE_COLORS.review).toBe('bg-pink-100 text-pink-800')
    })

    it('すべてのカラーがTailwind CSS形式である', () => {
      Object.values(CONTENT_TYPE_COLORS).forEach((color) => {
        expect(color).toMatch(/^bg-\w+-\d+ text-\w+-\d+$/)
      })
    })

    it('すべてのカラーに背景色とテキスト色が含まれている', () => {
      Object.values(CONTENT_TYPE_COLORS).forEach((color) => {
        expect(color).toContain('bg-')
        expect(color).toContain('text-')
      })
    })

    it('背景色は100（薄い色）が使用されている', () => {
      Object.values(CONTENT_TYPE_COLORS).forEach((color) => {
        expect(color).toMatch(/bg-\w+-100/)
      })
    })

    it('テキスト色は800（濃い色）が使用されている', () => {
      Object.values(CONTENT_TYPE_COLORS).forEach((color) => {
        expect(color).toMatch(/text-\w+-800/)
      })
    })

    it('各タイプで異なる色が使用されている', () => {
      const colors = Object.values(CONTENT_TYPE_COLORS)
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBe(colors.length)
    })
  })

  // ============================================================
  // 整合性チェック
  // ============================================================

  describe('整合性チェック', () => {
    it('CONTENT_TYPE_LABELSとCONTENT_TYPE_COLORSのキーが一致する', () => {
      const labelKeys = Object.keys(CONTENT_TYPE_LABELS).sort()
      const colorKeys = Object.keys(CONTENT_TYPE_COLORS).sort()

      expect(labelKeys).toEqual(colorKeys)
    })

    it('すべてのContentTypeに対してラベルとカラーが定義されている', () => {
      const contentTypes: ContentType[] = ['post', 'comment', 'event', 'shop', 'review']

      contentTypes.forEach((type) => {
        expect(CONTENT_TYPE_LABELS[type]).toBeDefined()
        expect(CONTENT_TYPE_COLORS[type]).toBeDefined()
      })
    })

    it('REPORT_REASONSの順序が適切（spam→その他）', () => {
      expect(REPORT_REASONS[0].value).toBe('spam')
      expect(REPORT_REASONS[REPORT_REASONS.length - 1].value).toBe('other')
    })
  })

  // ============================================================
  // 使用例のテスト
  // ============================================================

  describe('使用例', () => {
    it('セレクトボックスのオプション生成に使用できる', () => {
      const options = REPORT_REASONS.map((reason) => ({
        value: reason.value,
        label: reason.label,
      }))

      expect(options).toHaveLength(5)
      expect(options[0]).toEqual({ value: 'spam', label: 'スパム' })
    })

    it('バッジコンポーネントのスタイル生成に使用できる', () => {
      const contentType: ContentType = 'post'
      const label = CONTENT_TYPE_LABELS[contentType]
      const color = CONTENT_TYPE_COLORS[contentType]

      expect(label).toBe('投稿')
      expect(color).toBe('bg-blue-100 text-blue-800')
    })

    it('通報しきい値のチェックに使用できる', () => {
      const reportCount = 15

      expect(reportCount >= AUTO_HIDE_THRESHOLD).toBe(true)

      const belowThreshold = 5
      expect(belowThreshold >= AUTO_HIDE_THRESHOLD).toBe(false)
    })
  })
})

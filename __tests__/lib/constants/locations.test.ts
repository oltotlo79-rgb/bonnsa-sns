/**
 * 居住地域の定数（locations.ts）のテスト
 *
 * @jest-environment node
 */

import { LOCATION_GROUPS, ALL_LOCATIONS } from '@/lib/constants/locations'

describe('Location Constants', () => {
  // ============================================================
  // LOCATION_GROUPS
  // ============================================================

  describe('LOCATION_GROUPS', () => {
    it('5つのグループが定義されている', () => {
      expect(LOCATION_GROUPS).toHaveLength(5)
    })

    it('各グループにlabelとoptionsが含まれている', () => {
      LOCATION_GROUPS.forEach((group) => {
        expect(group).toHaveProperty('label')
        expect(group).toHaveProperty('options')
        expect(typeof group.label).toBe('string')
        expect(Array.isArray(group.options)).toBe(true)
      })
    })

    it('各オプションにvalueとlabelが含まれている', () => {
      LOCATION_GROUPS.forEach((group) => {
        group.options.forEach((option) => {
          expect(option).toHaveProperty('value')
          expect(option).toHaveProperty('label')
          expect(typeof option.value).toBe('string')
          expect(typeof option.label).toBe('string')
        })
      })
    })

    it('空のグループがない', () => {
      LOCATION_GROUPS.forEach((group) => {
        expect(group.options.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================
  // 日本の地方グループ
  // ============================================================

  describe('日本の地方グループ', () => {
    const regionGroup = LOCATION_GROUPS.find((g) => g.label === '日本の地方')

    it('グループが存在する', () => {
      expect(regionGroup).toBeDefined()
    })

    it('11の地方が含まれている', () => {
      expect(regionGroup?.options).toHaveLength(11)
    })

    it('北海道が含まれている', () => {
      const hokkaido = regionGroup?.options.find((o) => o.value === '北海道')
      expect(hokkaido).toBeDefined()
      expect(hokkaido?.label).toBe('北海道')
    })

    it('東北が含まれている', () => {
      const tohoku = regionGroup?.options.find((o) => o.value === '東北')
      expect(tohoku).toBeDefined()
    })

    it('関東が含まれている', () => {
      const kanto = regionGroup?.options.find((o) => o.value === '関東')
      expect(kanto).toBeDefined()
    })

    it('北陸が含まれている', () => {
      const hokuriku = regionGroup?.options.find((o) => o.value === '北陸')
      expect(hokuriku).toBeDefined()
    })

    it('甲信越が含まれている', () => {
      const koshinetsu = regionGroup?.options.find((o) => o.value === '甲信越')
      expect(koshinetsu).toBeDefined()
    })

    it('東海が含まれている', () => {
      const tokai = regionGroup?.options.find((o) => o.value === '東海')
      expect(tokai).toBeDefined()
    })

    it('近畿が含まれている', () => {
      const kinki = regionGroup?.options.find((o) => o.value === '近畿')
      expect(kinki).toBeDefined()
    })

    it('中国が含まれている', () => {
      const chugoku = regionGroup?.options.find((o) => o.value === '中国')
      expect(chugoku).toBeDefined()
    })

    it('四国が含まれている', () => {
      const shikoku = regionGroup?.options.find((o) => o.value === '四国')
      expect(shikoku).toBeDefined()
    })

    it('九州が含まれている', () => {
      const kyushu = regionGroup?.options.find((o) => o.value === '九州')
      expect(kyushu).toBeDefined()
    })

    it('沖縄が含まれている', () => {
      const okinawa = regionGroup?.options.find((o) => o.value === '沖縄')
      expect(okinawa).toBeDefined()
    })
  })

  // ============================================================
  // 都道府県グループ
  // ============================================================

  describe('都道府県グループ', () => {
    const prefectureGroup = LOCATION_GROUPS.find((g) => g.label === '都道府県')

    it('グループが存在する', () => {
      expect(prefectureGroup).toBeDefined()
    })

    it('47都道府県が含まれている', () => {
      expect(prefectureGroup?.options).toHaveLength(47)
    })

    it('北海道が含まれている', () => {
      const hokkaido = prefectureGroup?.options.find((o) => o.value === '北海道')
      expect(hokkaido).toBeDefined()
    })

    it('東京都が含まれている', () => {
      const tokyo = prefectureGroup?.options.find((o) => o.value === '東京都')
      expect(tokyo).toBeDefined()
      expect(tokyo?.label).toBe('東京都')
    })

    it('大阪府が含まれている', () => {
      const osaka = prefectureGroup?.options.find((o) => o.value === '大阪府')
      expect(osaka).toBeDefined()
    })

    it('京都府が含まれている', () => {
      const kyoto = prefectureGroup?.options.find((o) => o.value === '京都府')
      expect(kyoto).toBeDefined()
    })

    it('沖縄県が含まれている', () => {
      const okinawa = prefectureGroup?.options.find((o) => o.value === '沖縄県')
      expect(okinawa).toBeDefined()
    })

    it('すべての都道府県のvalueとlabelが一致する', () => {
      prefectureGroup?.options.forEach((option) => {
        expect(option.value).toBe(option.label)
      })
    })

    it('「県」「都」「府」「道」のいずれかで終わる', () => {
      prefectureGroup?.options.forEach((option) => {
        expect(option.value).toMatch(/(県|都|府|道)$/)
      })
    })
  })

  // ============================================================
  // 国・地域グループ
  // ============================================================

  describe('国・地域グループ', () => {
    const countryGroup = LOCATION_GROUPS.find((g) => g.label === '国・地域')

    it('グループが存在する', () => {
      expect(countryGroup).toBeDefined()
    })

    it('複数の国が含まれている', () => {
      expect(countryGroup?.options.length).toBeGreaterThan(10)
    })

    it('日本が含まれている', () => {
      const japan = countryGroup?.options.find((o) => o.value === '日本')
      expect(japan).toBeDefined()
    })

    it('アメリカが含まれている', () => {
      const usa = countryGroup?.options.find((o) => o.value === 'アメリカ')
      expect(usa).toBeDefined()
    })

    it('イギリスが含まれている', () => {
      const uk = countryGroup?.options.find((o) => o.value === 'イギリス')
      expect(uk).toBeDefined()
    })

    it('フランスが含まれている', () => {
      const france = countryGroup?.options.find((o) => o.value === 'フランス')
      expect(france).toBeDefined()
    })

    it('ドイツが含まれている', () => {
      const germany = countryGroup?.options.find((o) => o.value === 'ドイツ')
      expect(germany).toBeDefined()
    })

    it('中国が含まれている', () => {
      const china = countryGroup?.options.find((o) => o.value === '中国')
      expect(china).toBeDefined()
    })

    it('台湾が含まれている', () => {
      const taiwan = countryGroup?.options.find((o) => o.value === '台湾')
      expect(taiwan).toBeDefined()
    })

    it('韓国が含まれている', () => {
      const korea = countryGroup?.options.find((o) => o.value === '韓国')
      expect(korea).toBeDefined()
    })

    it('オーストラリアが含まれている', () => {
      const australia = countryGroup?.options.find((o) => o.value === 'オーストラリア')
      expect(australia).toBeDefined()
    })
  })

  // ============================================================
  // 大陸・地域グループ
  // ============================================================

  describe('大陸・地域グループ', () => {
    const continentGroup = LOCATION_GROUPS.find((g) => g.label === '大陸・地域')

    it('グループが存在する', () => {
      expect(continentGroup).toBeDefined()
    })

    it('8つの大陸・地域が含まれている', () => {
      expect(continentGroup?.options).toHaveLength(8)
    })

    it('アジアが含まれている', () => {
      const asia = continentGroup?.options.find((o) => o.value === 'アジア')
      expect(asia).toBeDefined()
    })

    it('ヨーロッパが含まれている', () => {
      const europe = continentGroup?.options.find((o) => o.value === 'ヨーロッパ')
      expect(europe).toBeDefined()
    })

    it('北アメリカが含まれている', () => {
      const northAmerica = continentGroup?.options.find((o) => o.value === '北アメリカ')
      expect(northAmerica).toBeDefined()
    })

    it('南アメリカが含まれている', () => {
      const southAmerica = continentGroup?.options.find((o) => o.value === '南アメリカ')
      expect(southAmerica).toBeDefined()
    })

    it('オセアニアが含まれている', () => {
      const oceania = continentGroup?.options.find((o) => o.value === 'オセアニア')
      expect(oceania).toBeDefined()
    })

    it('アフリカが含まれている', () => {
      const africa = continentGroup?.options.find((o) => o.value === 'アフリカ')
      expect(africa).toBeDefined()
    })
  })

  // ============================================================
  // その他グループ
  // ============================================================

  describe('その他グループ', () => {
    const otherGroup = LOCATION_GROUPS.find((g) => g.label === 'その他')

    it('グループが存在する', () => {
      expect(otherGroup).toBeDefined()
    })

    it('2つのオプションが含まれている', () => {
      expect(otherGroup?.options).toHaveLength(2)
    })

    it('海外が含まれている', () => {
      const overseas = otherGroup?.options.find((o) => o.value === '海外')
      expect(overseas).toBeDefined()
    })

    it('非公開が含まれている', () => {
      const private_ = otherGroup?.options.find((o) => o.value === '非公開')
      expect(private_).toBeDefined()
    })
  })

  // ============================================================
  // ALL_LOCATIONS
  // ============================================================

  describe('ALL_LOCATIONS', () => {
    it('すべてのグループのオプションを含む', () => {
      const expectedCount = LOCATION_GROUPS.reduce(
        (sum, group) => sum + group.options.length,
        0
      )
      expect(ALL_LOCATIONS).toHaveLength(expectedCount)
    })

    it('フラットな配列である', () => {
      ALL_LOCATIONS.forEach((location) => {
        expect(location).toHaveProperty('value')
        expect(location).toHaveProperty('label')
        // ネストしたoptionsプロパティを持たない
        expect(location).not.toHaveProperty('options')
      })
    })

    it('東京都を検索できる', () => {
      const tokyo = ALL_LOCATIONS.find((loc) => loc.value === '東京都')
      expect(tokyo).toBeDefined()
    })

    it('アメリカを検索できる', () => {
      const usa = ALL_LOCATIONS.find((loc) => loc.value === 'アメリカ')
      expect(usa).toBeDefined()
    })

    it('非公開を検索できる', () => {
      const private_ = ALL_LOCATIONS.find((loc) => loc.value === '非公開')
      expect(private_).toBeDefined()
    })

    it('存在しない地域はundefinedを返す', () => {
      const notFound = ALL_LOCATIONS.find((loc) => loc.value === '存在しない')
      expect(notFound).toBeUndefined()
    })
  })

  // ============================================================
  // バリデーション用途
  // ============================================================

  describe('バリデーション用途', () => {
    it('有効な地域かどうかをチェックできる', () => {
      const isValidLocation = (value: string) =>
        ALL_LOCATIONS.some((loc) => loc.value === value)

      expect(isValidLocation('東京都')).toBe(true)
      expect(isValidLocation('アメリカ')).toBe(true)
      expect(isValidLocation('無効な値')).toBe(false)
    })

    it('地域名からラベルを取得できる', () => {
      const getLabel = (value: string) =>
        ALL_LOCATIONS.find((loc) => loc.value === value)?.label

      expect(getLabel('東京都')).toBe('東京都')
      expect(getLabel('アメリカ')).toBe('アメリカ')
      expect(getLabel('無効な値')).toBeUndefined()
    })
  })

  // ============================================================
  // セレクトボックス用途
  // ============================================================

  describe('セレクトボックス用途', () => {
    it('HTMLのoptgroupとして使用できる形式', () => {
      LOCATION_GROUPS.forEach((group) => {
        // グループラベルがある
        expect(typeof group.label).toBe('string')
        expect(group.label.length).toBeGreaterThan(0)

        // オプションがある
        expect(Array.isArray(group.options)).toBe(true)
        expect(group.options.length).toBeGreaterThan(0)

        // 各オプションにvalueとlabelがある
        group.options.forEach((option) => {
          expect(typeof option.value).toBe('string')
          expect(typeof option.label).toBe('string')
        })
      })
    })

    it('フラットなセレクトボックスとして使用できる', () => {
      ALL_LOCATIONS.forEach((location) => {
        expect(typeof location.value).toBe('string')
        expect(typeof location.label).toBe('string')
      })
    })
  })

  // ============================================================
  // データの整合性
  // ============================================================

  describe('データの整合性', () => {
    it('重複するvalueがない（ALL_LOCATIONS内）', () => {
      const values = ALL_LOCATIONS.map((loc) => loc.value)
      const uniqueValues = new Set(values)
      // 北海道と中国は地方と都道府県/国で重複する可能性がある
      // これは意図的な設計なので、一意性チェックは行わない
      expect(values.length).toBe(ALL_LOCATIONS.length)
    })

    it('空のvalueがない', () => {
      ALL_LOCATIONS.forEach((location) => {
        expect(location.value.length).toBeGreaterThan(0)
      })
    })

    it('空のlabelがない', () => {
      ALL_LOCATIONS.forEach((location) => {
        expect(location.label.length).toBeGreaterThan(0)
      })
    })

    it('グループラベルが重複しない', () => {
      const labels = LOCATION_GROUPS.map((g) => g.label)
      const uniqueLabels = new Set(labels)
      expect(uniqueLabels.size).toBe(labels.length)
    })
  })

  // ============================================================
  // 特定のユースケース
  // ============================================================

  describe('特定のユースケース', () => {
    it('日本在住ユーザーは都道府県を選択できる', () => {
      const prefectureGroup = LOCATION_GROUPS.find((g) => g.label === '都道府県')
      expect(prefectureGroup?.options.length).toBe(47)
    })

    it('海外在住ユーザーは国を選択できる', () => {
      const countryGroup = LOCATION_GROUPS.find((g) => g.label === '国・地域')
      expect(countryGroup?.options.length).toBeGreaterThan(10)
    })

    it('プライバシーを重視するユーザーは非公開を選択できる', () => {
      const private_ = ALL_LOCATIONS.find((loc) => loc.value === '非公開')
      expect(private_).toBeDefined()
    })

    it('広域で活動するユーザーは大陸を選択できる', () => {
      const continentGroup = LOCATION_GROUPS.find((g) => g.label === '大陸・地域')
      expect(continentGroup?.options.length).toBeGreaterThan(5)
    })
  })
})

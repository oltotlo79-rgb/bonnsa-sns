/**
 * PostgreSQL全文検索セットアップスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/setup-fulltext-search.ts
 *
 * または環境変数SEARCH_MODEを設定してから実行:
 *   SEARCH_MODE=trgm npx tsx scripts/setup-fulltext-search.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SearchMode = 'bigm' | 'trgm' | 'like'

function getSearchMode(): SearchMode {
  const mode = process.env.SEARCH_MODE?.toLowerCase()
  if (mode === 'bigm' || mode === 'trgm') {
    return mode
  }
  return 'trgm' // デフォルトでtrgm
}

async function checkExtension(extension: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ available: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = ${extension}
      ) as available
    `
    return result[0]?.available ?? false
  } catch {
    return false
  }
}

async function enableExtension(extension: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "${extension}"`)
    console.log(`✅ ${extension} 拡張機能を有効化しました`)
    return true
  } catch (error) {
    console.error(`❌ ${extension} の有効化に失敗:`, error)
    return false
  }
}

async function createTrgmIndexes(): Promise<void> {
  console.log('📊 pg_trgm用GINインデックスを作成中...')

  try {
    // 類似度閾値を設定
    await prisma.$executeRaw`SELECT set_limit(0.1)`
    console.log('  - 類似度閾値を0.1に設定')

    // posts.content
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS posts_content_trgm_idx
      ON posts USING gin (content gin_trgm_ops)
    `
    console.log('  - posts_content_trgm_idx 作成完了')

    // users.nickname
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS users_nickname_trgm_idx
      ON users USING gin (nickname gin_trgm_ops)
    `
    console.log('  - users_nickname_trgm_idx 作成完了')

    // users.bio
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS users_bio_trgm_idx
      ON users USING gin (bio gin_trgm_ops)
    `
    console.log('  - users_bio_trgm_idx 作成完了')

    console.log('✅ pg_trgmインデックス作成完了')
  } catch (error) {
    console.error('❌ インデックス作成エラー:', error)
    throw error
  }
}

async function createBigmIndexes(): Promise<void> {
  console.log('📊 pg_bigm用GINインデックスを作成中...')

  try {
    // posts.content
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS posts_content_bigm_idx
      ON posts USING gin (content gin_bigm_ops)
    `
    console.log('  - posts_content_bigm_idx 作成完了')

    // users.nickname
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS users_nickname_bigm_idx
      ON users USING gin (nickname gin_bigm_ops)
    `
    console.log('  - users_nickname_bigm_idx 作成完了')

    // users.bio
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS users_bio_bigm_idx
      ON users USING gin (bio gin_bigm_ops)
    `
    console.log('  - users_bio_bigm_idx 作成完了')

    console.log('✅ pg_bigmインデックス作成完了')
  } catch (error) {
    console.error('❌ インデックス作成エラー:', error)
    throw error
  }
}

async function showCurrentIndexes(): Promise<void> {
  console.log('\n📋 現在のインデックス一覧:')
  const indexes = await prisma.$queryRaw<{ indexname: string; tablename: string }[]>`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE tablename IN ('posts', 'users')
    AND indexname LIKE '%trgm%' OR indexname LIKE '%bigm%'
    ORDER BY tablename, indexname
  `

  if (indexes.length === 0) {
    console.log('  (全文検索インデックスなし)')
  } else {
    for (const idx of indexes) {
      console.log(`  - ${idx.tablename}.${idx.indexname}`)
    }
  }
}

async function main() {
  const mode = getSearchMode()
  console.log(`\n🔧 PostgreSQL全文検索セットアップ`)
  console.log(`   検索モード: ${mode}`)
  console.log(`   環境変数 SEARCH_MODE=${process.env.SEARCH_MODE || '(未設定)'}\n`)

  // 現在の状態を確認
  const trgmAvailable = await checkExtension('pg_trgm')
  const bigmAvailable = await checkExtension('pg_bigm')

  console.log('📦 拡張機能の状態:')
  console.log(`  - pg_trgm: ${trgmAvailable ? '✅ 利用可能' : '❌ 未インストール'}`)
  console.log(`  - pg_bigm: ${bigmAvailable ? '✅ 利用可能' : '❌ 未インストール'}\n`)

  if (mode === 'trgm') {
    if (!trgmAvailable) {
      console.log('🔄 pg_trgmを有効化します...')
      const success = await enableExtension('pg_trgm')
      if (!success) {
        console.log('\n⚠️  pg_trgmの有効化に失敗しました。')
        console.log('   管理者権限で以下のSQLを実行してください:')
        console.log('   CREATE EXTENSION IF NOT EXISTS pg_trgm;')
        process.exit(1)
      }
    }
    await createTrgmIndexes()
  } else if (mode === 'bigm') {
    if (!bigmAvailable) {
      console.log('🔄 pg_bigmを有効化します...')
      const success = await enableExtension('pg_bigm')
      if (!success) {
        console.log('\n⚠️  pg_bigmの有効化に失敗しました。')
        console.log('   pg_bigmは別途インストールが必要です:')
        console.log('   https://pgbigm.osdn.jp/')
        console.log('\n   代わりにpg_trgmを使用する場合:')
        console.log('   SEARCH_MODE=trgm npx tsx scripts/setup-fulltext-search.ts')
        process.exit(1)
      }
    }
    await createBigmIndexes()
  } else {
    console.log('ℹ️  LIKE検索モードです。インデックスは不要です。')
  }

  await showCurrentIndexes()

  console.log('\n✨ セットアップ完了!')
  console.log('\n📝 .env.localに以下を追加してください:')
  console.log(`   SEARCH_MODE=${mode}`)
}

main()
  .catch((e) => {
    console.error('セットアップ中にエラーが発生:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

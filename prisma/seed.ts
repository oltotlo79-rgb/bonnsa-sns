import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const genres = [
  // 松柏類
  { name: '黒松', category: '松柏類', sortOrder: 1 },
  { name: '赤松', category: '松柏類', sortOrder: 2 },
  { name: '五葉松', category: '松柏類', sortOrder: 3 },
  { name: '真柏', category: '松柏類', sortOrder: 4 },
  { name: '杜松', category: '松柏類', sortOrder: 5 },
  { name: '檜', category: '松柏類', sortOrder: 6 },
  { name: '杉', category: '松柏類', sortOrder: 7 },
  { name: 'その他松柏類', category: '松柏類', sortOrder: 99 },

  // 雑木類
  { name: '紅葉', category: '雑木類', sortOrder: 1 },
  { name: '楓', category: '雑木類', sortOrder: 2 },
  { name: '銀杏', category: '雑木類', sortOrder: 3 },
  { name: '欅', category: '雑木類', sortOrder: 4 },
  { name: '梅', category: '雑木類', sortOrder: 5 },
  { name: '長寿梅', category: '雑木類', sortOrder: 6 },
  { name: '桜', category: '雑木類', sortOrder: 7 },
  { name: '皐月', category: '雑木類', sortOrder: 8 },
  { name: '椿', category: '雑木類', sortOrder: 9 },
  { name: '山茶花', category: '雑木類', sortOrder: 10 },
  { name: '柿', category: '雑木類', sortOrder: 11 },
  { name: '姫林檎', category: '雑木類', sortOrder: 12 },
  { name: 'その他雑木類', category: '雑木類', sortOrder: 99 },

  // 草もの
  { name: '草もの', category: '草もの', sortOrder: 1 },
  { name: '苔', category: '草もの', sortOrder: 2 },
  { name: '山野草', category: '草もの', sortOrder: 3 },

  // 用品・道具
  { name: '道具', category: '用品・道具', sortOrder: 1 },
  { name: '薬剤・肥料', category: '用品・道具', sortOrder: 2 },
  { name: '鉢', category: '用品・道具', sortOrder: 3 },
  { name: '用土', category: '用品・道具', sortOrder: 4 },
  { name: 'その他用品', category: '用品・道具', sortOrder: 99 },

  // 施設・イベント
  { name: '盆栽園', category: '施設・イベント', sortOrder: 1 },
  { name: '展示会', category: '施設・イベント', sortOrder: 2 },
  { name: '即売会', category: '施設・イベント', sortOrder: 3 },
  { name: '講習会', category: '施設・イベント', sortOrder: 4 },
]

async function main() {
  console.log('Seeding genres...')

  for (const genre of genres) {
    await prisma.genre.upsert({
      where: {
        id: `${genre.category}-${genre.name}`.replace(/[・]/g, '-'),
      },
      update: genre,
      create: {
        id: `${genre.category}-${genre.name}`.replace(/[・]/g, '-'),
        ...genre,
      },
    })
  }

  console.log(`Seeded ${genres.length} genres`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

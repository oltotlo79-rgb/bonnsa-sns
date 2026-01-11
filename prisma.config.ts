import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// .env.local があれば優先、なければ .env を読み込む
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config({ path: envPath });
}

export default defineConfig({
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
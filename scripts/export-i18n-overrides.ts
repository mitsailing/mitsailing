import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as z from 'zod';
import { PrismaClient } from '../src/generated/prisma/client';

const localeFileSchema = z.record(z.string(), z.record(z.string(), z.string()));

const locale = process.argv[2] ?? 'en';
const localePath = resolve(process.cwd(), `src/locales/${locale}.json`);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to export i18n overrides.');
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const raw = await readFile(localePath, 'utf8');
const parsedMessages: unknown = JSON.parse(raw);
const parseResult = localeFileSchema.safeParse(parsedMessages);
if (!parseResult.success) {
  throw new Error(`${localePath} is not a locale message file.`);
}
const messages = parseResult.data;
const overrides = await prisma.siteTextOverride.findMany({
  where: { locale },
  orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
  select: {
    namespace: true,
    key: true,
    value: true,
  },
});

let applied = 0;
let stale = 0;
for (const override of overrides) {
  const namespaceMessages = messages[override.namespace];
  if (!namespaceMessages || namespaceMessages[override.key] === undefined) {
    stale += 1;
    continue;
  }
  namespaceMessages[override.key] = override.value;
  applied += 1;
}

await writeFile(localePath, `${JSON.stringify(messages, null, 2)}\n`);
await prisma.$disconnect();
await pool.end();

console.log(
  `Exported ${applied} ${locale} override(s) to ${localePath}; ignored ${stale} stale override(s).`
);

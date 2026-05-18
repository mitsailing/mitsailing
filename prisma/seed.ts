import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { selectPasswordHashingOptions } from '../src/libs/auth/passwordHashing';
import { permissionGrantsForSeed } from '../src/libs/auth/permissions';
import { Role } from '../src/libs/auth/roles';
import { prisma } from '../src/libs/DB';
import { seedMitSailing } from './seedMitSailing/index';

const argonOpts = selectPasswordHashingOptions({
  isE2E: process.env.IS_E2E === '1',
});

/**
 * Admin bootstrap when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set (defaults
 * live in `.env.example`). Creates or updates a Better Auth credential Account
 * alongside the matching User. Run: `npm run db:seed` / `npx prisma db seed`
 */
async function main() {
  await seedMitSailing();
  await prisma.rolePermissionGrant.createMany({
    data: permissionGrantsForSeed(),
    skipDuplicates: true,
  });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const passwordHash = await hash(password, argonOpts);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      id: randomUUID(),
      email,
      name: 'Administrator',
      emailVerified: true,
      role: Role.ADMIN,
    },
    update: {
      emailVerified: true,
      role: Role.ADMIN,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: 'credential', accountId: user.id },
    },
    create: {
      id: randomUUID(),
      providerId: 'credential',
      accountId: user.id,
      userId: user.id,
      password: passwordHash,
    },
    update: { password: passwordHash },
  });
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
  try {
    await prisma.$disconnect();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

// eslint-disable-next-line no-void -- seed entry must not await (script exits when microtasks drain); errors handled inside run()
void run();

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { Options } from '@node-rs/argon2';
import { hash } from '@node-rs/argon2';
import { Role } from '../src/libs/auth/roles';
import { prisma } from '../src/libs/DB';

const argonOpts: Options = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2,
};

/**
 * Optional admin bootstrap when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.
 * Creates or updates a Better Auth credentials Account row (provider
 * `credential`) alongside the matching User. Run: `npx prisma db seed`
 */
async function main() {
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

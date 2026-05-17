import { connection } from 'next/server';

export async function safeConnection(): Promise<void> {
  try {
    await connection();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('outside a request scope')) {
      return;
    }
    throw error;
  }
}

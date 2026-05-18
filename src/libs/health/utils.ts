import { connection } from 'next/server';

function isOutsideRequestScopeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const digest =
    'digest' in error && typeof error.digest === 'string' ? error.digest : '';
  if (digest.includes('DYNAMIC_SERVER_USAGE')) {
    return true;
  }
  return /outside a request scope/iu.test(error.message);
}

export async function safeConnection(): Promise<void> {
  try {
    await connection();
  } catch (error: unknown) {
    if (isOutsideRequestScopeError(error)) {
      return;
    }
    throw error;
  }
}

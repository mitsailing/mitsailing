/* eslint-disable promise/avoid-new -- Node.js `net.Socket` uses callbacks */
import { createConnection } from 'node:net';
import type { Socket } from 'node:net';

const INSTREAM_CMD = Buffer.from('zINSTREAM\0', 'utf8');
const CHUNK_SIZE = 8192;

export type ClamdScanOptions = {
  host: string;
  port: number;
  timeoutMs: number;
};

export type ClamdScanResult =
  | { status: 'clean' }
  | { status: 'infected' }
  | { status: 'error'; message: string };

/**
 * Parses a single-line reply from `clamd` after INSTREAM (e.g. `stream: OK`).
 *
 * @param line - Raw reply without trailing CRLF normalization beyond trim
 * @returns Parsed scan outcome
 */
export function parseClamdInstreamReply(line: string): ClamdScanResult {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return { status: 'error', message: 'Empty reply from clamd' };
  }
  if (trimmed.includes('FOUND')) {
    return { status: 'infected' };
  }
  if (trimmed.includes('OK')) {
    return { status: 'clean' };
  }
  return { status: 'error', message: trimmed };
}

async function writeAll(socket: Socket, chunk: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.write(chunk, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function readReplyLine(socket: Socket): Promise<string> {
  const line = await new Promise<string>((resolve, reject) => {
    let acc = '';
    const handlers = {
      cleanup: (): void => {
        socket.off('data', handlers.onData);
        socket.off('end', handlers.onEnd);
        socket.off('error', handlers.onError);
        socket.off('timeout', handlers.onTimeout);
      },
      onData: (chunk: Buffer | string): void => {
        acc += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        const nl = acc.indexOf('\n');
        if (nl !== -1) {
          handlers.cleanup();
          resolve(acc.slice(0, nl));
        }
      },
      onEnd: (): void => {
        handlers.cleanup();
        if (acc.length === 0) {
          reject(new Error('Connection closed before clamd reply'));
        } else {
          resolve(acc);
        }
      },
      onError: (err: Error): void => {
        handlers.cleanup();
        reject(err);
      },
      onTimeout: (): void => {
        handlers.cleanup();
        reject(new Error('clamd read timed out'));
      },
    };

    socket.once('timeout', handlers.onTimeout);
    socket.on('data', handlers.onData);
    socket.once('end', handlers.onEnd);
    socket.once('error', handlers.onError);
  });
  return line;
}

async function openClamdSocket(
  host: string,
  port: number,
  timeoutMs: number
): Promise<Socket> {
  const socket = createConnection({ host, port });
  socket.setTimeout(timeoutMs);
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => {
        resolve();
      });
      socket.once('error', reject);
      socket.once('timeout', () => {
        reject(new Error('clamd connection timed out'));
      });
    });
  } catch (error: unknown) {
    socket.destroy();
    throw error;
  }
  return socket;
}

function clamdErrorFromReason(reason: unknown): ClamdScanResult {
  if (!(reason instanceof Error)) {
    return { status: 'error', message: 'clamd connection error' };
  }
  if (
    reason.message.includes('timed out') ||
    reason.message.includes('Timeout')
  ) {
    return { status: 'error', message: 'clamd connection timed out' };
  }
  return { status: 'error', message: reason.message };
}

/**
 * Sends `buf` to `clamd` via the INSTREAM protocol and returns the scan outcome.
 *
 * @param buf - File bytes to scan
 * @param options - Host, port, and socket timeout (covers connect + transfer + read)
 * @returns Clean, infected, or error (daemon unreachable, malformed reply, timeout)
 */
export async function scanBufferWithClamd(
  buf: Buffer,
  options: ClamdScanOptions
): Promise<ClamdScanResult> {
  const { host, port, timeoutMs } = options;
  let socket: Socket | undefined;

  try {
    socket = await openClamdSocket(host, port, timeoutMs);

    await writeAll(socket, INSTREAM_CMD);

    for (let offset = 0; offset < buf.byteLength; ) {
      const end = Math.min(offset + CHUNK_SIZE, buf.byteLength);
      const slice = buf.subarray(offset, end);
      const lenBuf = Buffer.allocUnsafe(4);
      lenBuf.writeUInt32BE(slice.byteLength, 0);
      await writeAll(socket, lenBuf);
      await writeAll(socket, slice);
      offset = end;
    }

    const zero = Buffer.allocUnsafe(4);
    zero.writeUInt32BE(0, 0);
    await writeAll(socket, zero);

    const line = await readReplyLine(socket);
    return parseClamdInstreamReply(line);
  } catch (error: unknown) {
    return clamdErrorFromReason(error);
  } finally {
    socket?.destroy();
  }
}

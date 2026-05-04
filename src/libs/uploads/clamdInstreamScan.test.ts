import { once } from 'node:events';
import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import {
  parseClamdInstreamReply,
  scanBufferWithClamd,
} from '@/libs/uploads/clamdInstreamScan';

const INSTREAM_PREFIX = Buffer.from('zINSTREAM\0', 'utf8');

/**
 * Consumes a minimal `clamd` INSTREAM session and returns reassembled payload chunks.
 *
 * @param socket - Incoming mock `clamd` connection
 * @returns Payload bytes sent between INSTREAM open and the terminating zero chunk
 */
async function collectInstreamPayload(socket: Socket): Promise<Buffer> {
  /* eslint-disable promise/avoid-new -- incremental TCP chunk parser */
  const payload = await new Promise<Buffer>((resolve, reject) => {
    let pending = Buffer.alloc(0);
    let mode: 'cmd' | 'len' | 'data' = 'cmd';
    let chunkLen = 0;
    const parts: Buffer[] = [];

    const pump = (): void => {
      if (mode === 'cmd') {
        if (pending.byteLength < INSTREAM_PREFIX.byteLength) {
          return;
        }
        if (
          !pending
            .subarray(0, INSTREAM_PREFIX.byteLength)
            .equals(INSTREAM_PREFIX)
        ) {
          reject(new Error('expected zINSTREAM'));
          return;
        }
        pending = pending.subarray(INSTREAM_PREFIX.byteLength);
        mode = 'len';
        pump();
        return;
      }
      if (mode === 'len') {
        if (pending.byteLength < 4) {
          return;
        }
        chunkLen = pending.readUInt32BE(0);
        pending = pending.subarray(4);
        if (chunkLen === 0) {
          resolve(Buffer.concat(parts));
          return;
        }
        mode = 'data';
        pump();
        return;
      }
      if (mode === 'data') {
        if (pending.byteLength < chunkLen) {
          return;
        }
        parts.push(pending.subarray(0, chunkLen));
        pending = pending.subarray(chunkLen);
        mode = 'len';
        pump();
      }
    };

    socket.on('data', (data: Buffer) => {
      pending = Buffer.concat([pending, data]);
      pump();
    });
    socket.once('error', reject);
  });
  /* eslint-enable promise/avoid-new */
  return payload;
}

async function withMockClamd(
  onConnection: (socket: Socket) => void
): Promise<{ port: number; close: () => Promise<void> }> {
  const server: Server = createServer(onConnection);
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('expected TCP bind');
  }
  return {
    port: addr.port,
    close: async () => {
      const closed = once(server, 'close');
      server.close();
      await closed;
    },
  };
}

describe('parseClamdInstreamReply', () => {
  it('treats stream OK as clean', () => {
    expect(parseClamdInstreamReply('stream: OK')).toEqual({ status: 'clean' });
  });

  it('treats FOUND as infected', () => {
    expect(
      parseClamdInstreamReply('stream: Eicar-Test-Signature FOUND')
    ).toEqual({ status: 'infected' });
  });

  it('returns error for empty line', () => {
    const r = parseClamdInstreamReply('  \n  ');
    expect(r).toEqual({ status: 'error', message: 'Empty reply from clamd' });
  });

  it('returns error for unexpected reply', () => {
    const r = parseClamdInstreamReply('INSTREAM size limit exceeded');
    expect(r.status).toBe('error');
    if (r.status === 'error') {
      expect(r.message).toContain('INSTREAM');
    }
  });
});

describe('scanBufferWithClamd', () => {
  it('receives INSTREAM payload and returns clean for OK', async () => {
    const payload = Buffer.from('hello');
    const { port, close } = await withMockClamd((socket) => {
      collectInstreamPayload(socket)
        .then((body) => {
          expect(body.equals(payload)).toBe(true);
          socket.write('stream: OK\n');
          socket.end();
        })
        .catch(() => {
          socket.destroy();
        });
    });

    const result = await scanBufferWithClamd(payload, {
      host: '127.0.0.1',
      port,
      timeoutMs: 5000,
    });

    expect(result).toEqual({ status: 'clean' });
    await close();
  });

  it('returns infected when clamd reports FOUND', async () => {
    const payload = Buffer.from(
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
    );
    const { port, close } = await withMockClamd((socket) => {
      collectInstreamPayload(socket)
        .then(() => {
          socket.write('stream: Eicar-Test-Signature FOUND\n');
          socket.end();
        })
        .catch(() => {
          socket.destroy();
        });
    });

    const result = await scanBufferWithClamd(payload, {
      host: '127.0.0.1',
      port,
      timeoutMs: 5000,
    });

    expect(result).toEqual({ status: 'infected' });
    await close();
  });

  it('returns error for malformed reply line', async () => {
    const payload = Buffer.from('x');
    const { port, close } = await withMockClamd((socket) => {
      collectInstreamPayload(socket)
        .then(() => {
          socket.write('garbage response\n');
          socket.end();
        })
        .catch(() => {
          socket.destroy();
        });
    });

    const result = await scanBufferWithClamd(payload, {
      host: '127.0.0.1',
      port,
      timeoutMs: 5000,
    });

    expect(result.status).toBe('error');
    await close();
  });

  it('returns error on timeout when server is silent', async () => {
    const server = createServer((socket) => {
      socket.on('data', () => {
        /* drain but never reply */
      });
    });
    const listening = once(server, 'listening');
    server.listen(0, '127.0.0.1');
    await listening;
    const addr = server.address();
    if (addr === null || typeof addr === 'string') {
      throw new Error('expected TCP bind');
    }

    const result = await scanBufferWithClamd(Buffer.from('a'), {
      host: '127.0.0.1',
      port: addr.port,
      timeoutMs: 150,
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toMatch(/timed out|clamd/);
    }
    const closed = once(server, 'close');
    server.close();
    await closed;
  });
});

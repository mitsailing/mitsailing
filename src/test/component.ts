import { vi } from 'vitest';

type ComponentTestRouter = {
  push: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
};

const router: ComponentTestRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

let currentPathname = '/profile';
let currentSearchParams = new URLSearchParams();

/**
 * Returns the shared mock App Router instance for component tests.
 *
 * @returns Shared router mock.
 */
export function componentTestRouter() {
  return router;
}

/**
 * Returns the current mocked pathname for navigation hooks.
 *
 * @returns Current mocked pathname.
 */
export function componentTestPathname() {
  return currentPathname;
}

/**
 * Returns a copy of the current mocked search params.
 *
 * @returns Current mocked search params.
 */
export function componentTestSearchParams() {
  return new URLSearchParams(currentSearchParams);
}

/**
 * Sets the mocked pathname returned by component navigation hooks.
 *
 * @param pathname - Pathname to expose through navigation hooks.
 */
export function setComponentTestPathname(pathname: string) {
  currentPathname = pathname;
}

/**
 * Sets the mocked search string returned by component navigation hooks.
 *
 * @param searchParams - Query string to expose through navigation hooks.
 */
export function setComponentTestSearchParams(searchParams: string) {
  currentSearchParams = new URLSearchParams(searchParams);
}

/** Clears router calls and restores default component navigation state. */
export function resetComponentTestState() {
  router.push.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
  currentPathname = '/profile';
  currentSearchParams = new URLSearchParams();
}

/** Installs an isolated localStorage mock for component tests. */
export function installComponentTestLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => {
        storage.clear();
      },
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  });
}

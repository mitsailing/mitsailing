import { vi } from 'vitest';

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

let currentPathname = '/profile/account/';

export function componentTestRouter() {
  return router;
}

export function componentTestPathname() {
  return currentPathname;
}

export function setComponentTestPathname(pathname: string) {
  currentPathname = pathname;
}

export function resetComponentTestRouter() {
  router.push.mockClear();
  router.refresh.mockClear();
  router.replace.mockClear();
  currentPathname = '/profile/account/';
}

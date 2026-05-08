import { vi } from 'vitest';

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

let currentPathname = '/profile/account/';
let currentSearchParams = new URLSearchParams();

export function componentTestRouter() {
  return router;
}

export function componentTestPathname() {
  return currentPathname;
}

export function componentTestSearchParams() {
  return currentSearchParams;
}

export function setComponentTestPathname(pathname: string) {
  currentPathname = pathname;
}

export function setComponentTestSearchParams(searchParams: string) {
  currentSearchParams = new URLSearchParams(searchParams);
}

export function resetComponentTestRouter() {
  router.push.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
  currentPathname = '/profile/account/';
  currentSearchParams = new URLSearchParams();
}

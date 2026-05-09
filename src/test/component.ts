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

let currentPathname = '/profile/account/';
let currentSearchParams = new URLSearchParams();

export function componentTestRouter() {
  return router;
}

export function componentTestPathname() {
  return currentPathname;
}

export function componentTestSearchParams() {
  return new URLSearchParams(currentSearchParams);
}

export function setComponentTestPathname(pathname: string) {
  currentPathname = pathname;
}

export function setComponentTestSearchParams(searchParams: string) {
  currentSearchParams = new URLSearchParams(searchParams);
}

export function resetComponentTestState() {
  router.push.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
  currentPathname = '/profile/account/';
  currentSearchParams = new URLSearchParams();
}

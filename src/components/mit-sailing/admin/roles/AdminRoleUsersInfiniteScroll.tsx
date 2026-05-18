'use client';

import { useEffect } from 'react';

const ROLE_USERS_CONTAINER_SELECTOR = '.js-role-admin-users';
const ROLE_USERS_COUNT_SELECTOR = '.js-role-admin-users-count';
const ROLE_USER_ROW_SELECTOR = '.js-role-admin-user-row';
const ROLE_USERS_NEXT_SELECTOR = '.js-role-admin-users-next';
const ROLE_USERS_NAV_SELECTOR = '.js-role-admin-users-nav';
const ROLE_USERS_STATUS_SELECTOR = '.js-role-admin-users-status';

function updateLoadedUserCount() {
  const countElement = document.querySelector(ROLE_USERS_COUNT_SELECTOR);
  if (!(countElement instanceof HTMLElement)) {
    return;
  }
  const { template, totalCount } = countElement.dataset;
  if (!(template && totalCount)) {
    return;
  }

  const loadedCount = document.querySelectorAll(ROLE_USER_ROW_SELECTOR).length;
  countElement.textContent = template
    .replace('{count}', String(loadedCount))
    .replace('{total}', totalCount);
}

export function AdminRoleUsersInfiniteScroll() {
  useEffect(() => {
    let infiniteScroll: InfiniteScroll | null = null;
    let cancelled = false;

    const animationFrame = globalThis.requestAnimationFrame(async () => {
      const container = document.querySelector(ROLE_USERS_CONTAINER_SELECTOR);
      const nextLink = document.querySelector(ROLE_USERS_NEXT_SELECTOR);
      if (!(container && nextLink)) {
        return;
      }

      try {
        const { default: InfiniteScroll } = await import('infinite-scroll');
        if (cancelled) {
          return;
        }

        infiniteScroll = new InfiniteScroll(container, {
          append: ROLE_USER_ROW_SELECTOR,
          checkLastPage: ROLE_USERS_NEXT_SELECTOR,
          hideNav: ROLE_USERS_NAV_SELECTOR,
          history: false,
          path: ROLE_USERS_NEXT_SELECTOR,
          status: ROLE_USERS_STATUS_SELECTOR,
        });
        infiniteScroll.on('append', updateLoadedUserCount);
      } catch {
        infiniteScroll = null;
      }
    });

    return () => {
      cancelled = true;
      globalThis.cancelAnimationFrame(animationFrame);
      infiniteScroll?.destroy();
    };
  }, []);

  return null;
}

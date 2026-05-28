'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { isNavLinkActive } from '@/lib/mit-sailing/navPathMatch';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

const desktopNavTriggerClass =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2.5 -mx-0.5 text-sm font-medium text-mit-text shadow-none transition-colors duration-200 hover:bg-muted/60 hover:text-primary-ink dark:!text-white dark:hover:bg-white/5 dark:hover:!text-white aria-expanded:bg-muted/70 aria-expanded:text-primary-ink dark:aria-expanded:bg-white/10 dark:aria-expanded:!text-white';

/** Bleed: `-mx-3` plus `w-[calc(100%+1.5rem)]` must stay matched (2 × Tailwind spacing 3). */
const mobileNavTriggerClass =
  'flex h-auto min-h-[44px] w-[calc(100%+1.5rem)] max-w-none shrink-0 -mx-3 items-center justify-between rounded-md px-3 py-3 text-sm font-medium text-mit-text shadow-none transition-colors duration-200 hover:text-primary-ink dark:!text-white dark:hover:!text-white aria-expanded:text-primary-ink dark:aria-expanded:!text-white';

/**
 * Disclosure-style navigation submenu (APG disclosure navigation).
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/}
 */

export type NavigationDropdownItem = {
  /** Visible label. */
  label: string;
  /** Internal route. Use either `href` (internal) or `externalHref`, not both. */
  href?: string;
  /** External URL for non-routed links (e.g. `https://...` or `#`). */
  externalHref?: string;
  /** Optional short description shown under the label. */
  description?: string;
};

export type NavigationDropdownVariant = 'desktop' | 'mobile';

export type NavigationDropdownProps = {
  label: string;
  /** Locale-free pathname from `createNavigation()` `usePathname()`. */
  pathname: string;
  /** `location.hash` without `#` (hashchange-aware). */
  routeHash: string;
  /** Primary route for the section (e.g. "/fleet"). Rendered as an overview link. */
  href?: string;
  items: NavigationDropdownItem[];
  variant?: NavigationDropdownVariant;
  /** Called after any link inside the submenu is activated; useful for closing a parent mobile menu. */
  onNavigate?: () => void;
  /**
   * Label for the overview link at the top of the submenu. Callers (e.g. site header) usually
   * pass a section-specific string; when omitted, defaults to `MitSailingSite.nav_overview_all`
   * with this dropdown's `label` as `{label}`.
   */
  overviewLabel?: string;
};

function useDismiss(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const close = () => {
      setOpen(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      const node = ref.current;
      const { target } = event;
      if (node && target instanceof Node && !node.contains(target)) {
        close();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const node = ref.current;
      const { target } = event;
      if (node && target instanceof Node && !node.contains(target)) {
        close();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [enabled, setOpen, ref]);
}

/**
 * Disclosure-style nav submenu.
 *
 * @param props - Dropdown props
 * @returns Disclosure trigger and link list
 */
export function NavigationDropdown(props: NavigationDropdownProps) {
  const {
    label,
    pathname,
    routeHash,
    href,
    items,
    variant = 'desktop',
    onNavigate,
    overviewLabel,
  } = props;
  const t = useTranslations('MitSailingSite');
  const reactId = useId();
  const panelId = `nav-dd-${reactId}`;
  const triggerId = `${panelId}-trigger`;

  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const hoverTimeoutRef = useRef<number | null>(null);

  const resolvedItems: NavigationDropdownItem[] = href
    ? [
        {
          label: overviewLabel ?? t('nav_overview_all', { label }),
          href,
        },
        ...items,
      ]
    : items;

  useDismiss(wrapperRef, isOpen && variant === 'desktop', setIsOpen);

  function focusItem(index: number) {
    const count = itemRefs.current.length;
    if (count === 0) {
      return;
    }
    const wrapped = ((index % count) + count) % count;
    itemRefs.current[wrapped]?.focus();
  }

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Down': {
        event.preventDefault();
        setIsOpen(true);
        window.setTimeout(() => {
          focusItem(0);
        }, 0);
        break;
      }
      case 'ArrowUp':
      case 'Up': {
        event.preventDefault();
        setIsOpen(true);
        window.setTimeout(() => {
          focusItem(-1);
        }, 0);
        break;
      }
      case 'Escape':
      case 'Esc': {
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  const onItemKeyDown = (
    event: ReactKeyboardEvent<HTMLAnchorElement>,
    index: number
  ) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Down': {
        event.preventDefault();
        focusItem(index + 1);
        break;
      }
      case 'ArrowUp':
      case 'Up': {
        event.preventDefault();
        focusItem(index - 1);
        break;
      }
      case 'Home': {
        event.preventDefault();
        focusItem(0);
        break;
      }
      case 'End': {
        event.preventDefault();
        focusItem(-1);
        break;
      }
      case 'Escape':
      case 'Esc': {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        break;
      }
      default: {
        break;
      }
    }
  };

  const onMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(true);
    }, 60);
  };
  const onMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 140);
  };

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    },
    []
  );

  const handleItemClick = (_event: ReactMouseEvent<HTMLAnchorElement>) => {
    setIsOpen(false);
    onNavigate?.();
  };

  /** Submenu links: same look for all rows; `aria-current` is set for assistive tech only. */
  const subMenuLinkClassName = cn(
    'block w-full min-h-[44px] text-sm font-medium text-foreground no-underline transition-colors',
    'hover:bg-muted/80 focus-visible:bg-muted/80',
    textFocusRingClassName
  );
  const itemClassName =
    variant === 'mobile'
      ? cn(subMenuLinkClassName, 'rounded-md py-3 pl-4 pr-0')
      : cn(subMenuLinkClassName, 'px-3 py-2.5');

  const listItems = resolvedItems.map((item, index) => {
    const setRef = (el: HTMLAnchorElement | null) => {
      itemRefs.current[index] = el;
    };
    const internalActive =
      typeof item.href === 'string'
        ? isNavLinkActive(pathname, routeHash, item.href)
        : false;
    const content = (
      <>
        <span className="block">{item.label}</span>
        {item.description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </>
    );

    return (
      <li
        className="w-full min-w-0"
        key={item.href ?? item.externalHref ?? item.label}
        role="none"
      >
        {item.href ? (
          <Link
            aria-current={internalActive ? 'page' : undefined}
            className={itemClassName}
            href={item.href}
            id={`${panelId}-item-${index}`}
            onClick={handleItemClick}
            onKeyDown={(e) => {
              onItemKeyDown(e, index);
            }}
            ref={setRef}
          >
            {content}
          </Link>
        ) : (
          <a
            className={itemClassName}
            href={item.externalHref ?? '#'}
            id={`${panelId}-item-${index}`}
            onClick={handleItemClick}
            onKeyDown={(e) => {
              onItemKeyDown(e, index);
            }}
            ref={setRef}
          >
            {content}
          </a>
        )}
      </li>
    );
  });

  const trigger = (
    <Button
      aria-controls={panelId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      className={cn(
        variant === 'desktop' && desktopNavTriggerClass,
        variant === 'mobile' &&
          cn(mobileNavTriggerClass, textFocusRingClassName),
        variant === 'desktop' && textFocusRingClassName
      )}
      id={triggerId}
      onClick={() => {
        setIsOpen((open) => !open);
      }}
      onKeyDown={onTriggerKeyDown}
      ref={triggerRef}
      type="button"
      variant="ghost"
    >
      <span>{label}</span>
      <ChevronDown
        aria-hidden="true"
        className={`shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none${isOpen ? ' rotate-180' : ''}`}
        size={16}
      />
    </Button>
  );

  if (variant === 'mobile') {
    return (
      <div ref={wrapperRef}>
        {trigger}
        <ul
          aria-labelledby={triggerId}
          className="flex flex-col"
          hidden={!isOpen}
          id={panelId}
        >
          {listItems}
        </ul>
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      ref={wrapperRef}
    >
      {trigger}
      <div
        className="absolute top-full left-0 z-50 mt-1.5 min-w-[260px] overflow-x-hidden rounded-xl border border-border bg-card py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
        hidden={!isOpen}
      >
        <ul
          aria-labelledby={triggerId}
          className="flex min-w-0 flex-col"
          id={panelId}
        >
          {listItems}
        </ul>
      </div>
    </div>
  );
}

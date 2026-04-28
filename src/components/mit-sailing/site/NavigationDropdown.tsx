'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

/**
 * Accessible disclosure-style navigation submenu.
 *
 * Follows the W3C APG "Disclosure Navigation Menu" pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/):
 * the trigger is a disclosure control (`Button`) with `aria-expanded` /
 * `aria-controls`, and the
 * panel is a plain list of links (no `role="menu"` because these are site-nav
 * links, not commands).
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
  /** Primary route for the section (e.g. "/fleet"). Rendered as an overview link. */
  href?: string;
  items: NavigationDropdownItem[];
  variant?: NavigationDropdownVariant;
  /** Called after any link inside the submenu is activated; useful for closing a parent mobile menu. */
  onNavigate?: () => void;
  /** Label for the overview link at the top of the submenu. Defaults to `All {label}`. */
  overviewLabel?: string;
};

function useDismiss(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  close: () => void
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
  }, [isOpen, close, ref]);
}

/**
 * @param props - Dropdown props
 * @returns Disclosure-style nav submenu
 */
export function NavigationDropdown(props: NavigationDropdownProps) {
  const {
    label,
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

  const resolvedItems = useMemo<NavigationDropdownItem[]>(() => {
    if (!href) {
      return items;
    }
    return [
      {
        label: overviewLabel ?? t('nav_overview_all', { label }),
        href,
      },
      ...items,
    ];
  }, [items, href, label, overviewLabel, t]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  const open = useCallback(() => {
    setIsOpen(true);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  useDismiss(wrapperRef, isOpen && variant === 'desktop', close);

  const focusItem = useCallback((index: number) => {
    const count = itemRefs.current.length;
    if (count === 0) {
      return;
    }
    const wrapped = ((index % count) + count) % count;
    itemRefs.current[wrapped]?.focus();
  }, []);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Down': {
        event.preventDefault();
        open();
        window.setTimeout(() => {
          focusItem(0);
        }, 0);
        break;
      }
      case 'ArrowUp':
      case 'Up': {
        event.preventDefault();
        open();
        window.setTimeout(() => {
          focusItem(-1);
        }, 0);
        break;
      }
      case 'Escape':
      case 'Esc': {
        if (isOpen) {
          event.preventDefault();
          close();
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
        close();
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        close();
        break;
      }
      default: {
        break;
      }
    }
  };

  const onMouseEnter = () => {
    if (variant !== 'desktop') {
      return;
    }
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      open();
    }, 80);
  };
  const onMouseLeave = () => {
    if (variant !== 'desktop') {
      return;
    }
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      close();
    }, 120);
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
    close();
    onNavigate?.();
  };

  const itemClassName = `block w-full min-h-[44px] px-4 py-3 text-sm font-medium text-mit-text no-underline transition-colors hover:bg-mit-red-highlight focus-visible:bg-mit-red-highlight ${textFocusRingClassName}`;

  const renderItemLink = (item: NavigationDropdownItem, index: number) => {
    const setRef = (el: HTMLAnchorElement | null) => {
      itemRefs.current[index] = el;
    };
    const content = (
      <>
        <span className="block">{item.label}</span>
        {item.description ? (
          <span className="mt-0.5 block text-xs text-mit-text/80">
            {item.description}
          </span>
        ) : null}
      </>
    );

    if (item.href) {
      return (
        <Link
          className={itemClassName}
          href={item.href}
          id={`${panelId}-item-${index}`}
          onClick={handleItemClick}
          onKeyDown={(e) => {
            onItemKeyDown(e, index);
          }}
          ref={setRef}
          role="menuitem"
        >
          {content}
        </Link>
      );
    }

    return (
      <a
        className={itemClassName}
        href={item.externalHref ?? '#'}
        id={`${panelId}-item-${index}`}
        onClick={handleItemClick}
        onKeyDown={(e) => {
          onItemKeyDown(e, index);
        }}
        ref={setRef}
        role="menuitem"
      >
        {content}
      </a>
    );
  };

  const trigger = (
    <Button
      aria-controls={panelId}
      aria-expanded={isOpen}
      aria-haspopup="true"
      className={cn(
        variant === 'desktop'
          ? 'inline-flex min-h-[44px] items-center gap-1 px-1'
          : 'flex min-h-[44px] w-full items-center justify-between py-3',
        'rounded-sm text-sm font-medium text-mit-text shadow-none transition-opacity hover:bg-transparent hover:opacity-70',
        textFocusRingClassName
      )}
      id={triggerId}
      onClick={toggle}
      onKeyDown={onTriggerKeyDown}
      ref={triggerRef}
      type="button"
      variant="ghost"
    >
      <span>{label}</span>
      <ChevronDown
        aria-hidden="true"
        className={`shrink-0 transition-transform duration-150 ease-out${isOpen ? ' rotate-180' : ''}`}
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
          className="flex flex-col pb-2 pl-4"
          hidden={!isOpen}
          id={panelId}
          role="menu"
        >
          {resolvedItems.map((item, index) => (
            <li key={item.label} role="none">
              {renderItemLink(item, index)}
            </li>
          ))}
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
        aria-labelledby={triggerId}
        className="absolute top-full left-0 z-50 mt-2 min-w-[240px] rounded-lg border border-mit-line bg-white py-2 shadow-lg"
        hidden={!isOpen}
        id={panelId}
        role="menu"
      >
        <ul className="flex flex-col">
          {resolvedItems.map((item, index) => (
            <li key={item.label} role="none">
              {renderItemLink(item, index)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

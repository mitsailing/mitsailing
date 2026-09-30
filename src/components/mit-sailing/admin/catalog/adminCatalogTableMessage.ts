import type { useTranslations } from 'next-intl';
import type {
  AdminCatalogResourceMessageKey,
  AdminTableMessageKey,
  AdminUsersMessageKey,
} from '@/libs/admin/catalog/types';

type CatalogTableMessageOptions = {
  readonly key: AdminTableMessageKey;
  readonly messageNamespace: 'AdminCatalogResource' | 'AdminUsers' | undefined;
  readonly tCatalog: ReturnType<typeof useTranslations<'AdminCatalogResource'>>;
  readonly tUsers: ReturnType<typeof useTranslations<'AdminUsers'>>;
};

/**
 * Resolve catalog vs users admin table message keys.
 *
 * @param options - Message key, namespace, and next-intl translators
 * @returns Localized table string for the key
 */
export function catalogTableMessage(options: CatalogTableMessageOptions) {
  if (options.messageNamespace === 'AdminUsers') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- messageNamespace picks users keys
    return options.tUsers(options.key as AdminUsersMessageKey);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- default catalog keys
  return options.tCatalog(options.key as AdminCatalogResourceMessageKey);
}

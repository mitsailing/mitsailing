import enMessages from '@/locales/en.json';

export type MessageCatalog = Record<string, Record<string, string>>;

export type SiteTextOverrideInput = {
  namespace: string;
  key: string;
  value: string;
};

export type SiteTextEntry = {
  namespace: string;
  key: string;
  defaultValue: string;
  liveValue: string;
  overrideValue: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  updatedByEmail: string | null;
};

export type SiteTextOverrideForList = SiteTextOverrideInput & {
  updatedAt: Date;
  updatedBy: {
    name: string | null;
    email: string | null;
  } | null;
};

export const defaultSiteTextMessages: MessageCatalog = enMessages;

function sortedValues(values: Iterable<string>): string[] {
  return [...values].toSorted((a, b) => a.localeCompare(b));
}

function extractBracedTokens(value: string): Set<string> {
  const tokens = new Set<string>();
  const tokenPattern = /\{([A-Za-z_][\w.-]*)\}/g;
  for (const match of value.matchAll(tokenPattern)) {
    const [, token] = match;
    if (token) {
      tokens.add(token);
    }
  }
  return tokens;
}

function extractRichTags(value: string): Set<string> {
  const tags = new Set<string>();
  const tagPattern = /<\/?([A-Za-z][\w.-]*)\b[^>]*>/g;
  for (const match of value.matchAll(tagPattern)) {
    const [, tag] = match;
    if (tag) {
      tags.add(tag);
    }
  }
  return tags;
}

function equalSets(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Reads the file-backed default string for a site text namespace/key pair.
 *
 * @param namespace - Top-level namespace in `en.json`
 * @param key - String key inside the namespace
 * @param messages - Message catalog to read from
 * @returns The default string when the key exists
 */
export function getDefaultSiteTextValue(
  namespace: string,
  key: string,
  messages: MessageCatalog = defaultSiteTextMessages
): string | null {
  return messages[namespace]?.[key] ?? null;
}

/**
 * Checks whether an admin override can safely replace the default message.
 *
 * @param defaultValue - File-backed fallback string
 * @param overrideValue - Admin-entered replacement string
 * @returns Validation result and stable error code
 */
export function validateSiteTextOverrideValue(
  defaultValue: string,
  overrideValue: string
): { ok: true } | { ok: false; code: 'placeholder_mismatch' } {
  const defaultTokens = extractBracedTokens(defaultValue);
  const overrideTokens = extractBracedTokens(overrideValue);
  if (!equalSets(defaultTokens, overrideTokens)) {
    return { ok: false, code: 'placeholder_mismatch' };
  }

  const defaultTags = extractRichTags(defaultValue);
  const overrideTags = extractRichTags(overrideValue);
  if (!equalSets(defaultTags, overrideTags)) {
    return { ok: false, code: 'placeholder_mismatch' };
  }

  return { ok: true };
}

/**
 * Applies persisted overrides over file-backed messages, ignoring stale keys.
 *
 * @param messages - File-backed locale messages
 * @param overrides - DB override rows
 * @returns A merged message catalog
 */
export function mergeSiteTextMessages(
  messages: MessageCatalog,
  overrides: readonly SiteTextOverrideInput[]
): MessageCatalog {
  const merged = Object.fromEntries(
    Object.entries(messages).map(([namespace, values]) => [
      namespace,
      { ...values },
    ])
  );

  for (const override of overrides) {
    if (messages[override.namespace]?.[override.key] === undefined) {
      continue;
    }
    const namespaceMessages = merged[override.namespace];
    if (namespaceMessages) {
      namespaceMessages[override.key] = override.value;
    }
  }

  return merged;
}

/**
 * Builds the admin table rows from defaults and override rows.
 *
 * @param overrides - DB override rows with editor metadata
 * @param messages - File-backed locale messages
 * @returns Sorted rows for the Site text admin page
 */
export function listSiteTextEntries(
  overrides: readonly SiteTextOverrideForList[],
  messages: MessageCatalog = defaultSiteTextMessages
): SiteTextEntry[] {
  const overridesById = new Map(
    overrides.map((override) => [
      `${override.namespace}\u0000${override.key}`,
      override,
    ])
  );

  const entries: SiteTextEntry[] = [];
  for (const namespace of sortedValues(Object.keys(messages))) {
    const namespaceMessages = messages[namespace];
    if (!namespaceMessages) {
      continue;
    }
    for (const key of sortedValues(Object.keys(namespaceMessages))) {
      const override = overridesById.get(`${namespace}\u0000${key}`) ?? null;
      const defaultValue = namespaceMessages[key] ?? '';
      entries.push({
        namespace,
        key,
        defaultValue,
        liveValue: override?.value ?? defaultValue,
        overrideValue: override?.value ?? null,
        updatedAt: override?.updatedAt.toISOString() ?? null,
        updatedByName: override?.updatedBy?.name ?? null,
        updatedByEmail: override?.updatedBy?.email ?? null,
      });
    }
  }

  return entries;
}

/**
 * Returns override rows whose keys no longer exist in the file defaults.
 *
 * @param overrides - DB override rows
 * @param messages - File-backed locale messages
 * @returns Stale override identifiers
 */
export function listStaleSiteTextOverrides(
  overrides: readonly SiteTextOverrideInput[],
  messages: MessageCatalog = defaultSiteTextMessages
): SiteTextOverrideInput[] {
  return overrides.filter(
    (override) => messages[override.namespace]?.[override.key] === undefined
  );
}

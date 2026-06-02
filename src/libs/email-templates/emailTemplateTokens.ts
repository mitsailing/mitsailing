const TOKEN_PATTERN = /\{([A-Za-z]\w*)\}/g;

function tokensInTemplate(value: string): string[] {
  const tokens = new Set<string>();
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    if (match[1]) {
      tokens.add(match[1]);
    }
  }
  return [...tokens].toSorted((left, right) => left.localeCompare(right));
}

export function interpolateTemplateTokens(
  value: string,
  replacements: Readonly<Record<string, string | null | undefined>>
): string {
  return value.replaceAll(TOKEN_PATTERN, (token, key: string) => {
    if (!Object.hasOwn(replacements, key)) {
      return token;
    }
    return replacements[key] ?? '';
  });
}

export function unknownTemplateTokens(
  value: string,
  allowedTokens: readonly string[]
): string[] {
  const allowed = new Set(allowedTokens);
  return tokensInTemplate(value).filter((token) => !allowed.has(token));
}

function basicLegacyEntityReplacement(entity: string): string {
  if (entity === '#39') {
    return "'";
  }
  if (entity === 'amp') {
    return '&';
  }
  if (entity === 'gt') {
    return '>';
  }
  if (entity === 'lt') {
    return '<';
  }
  return '"';
}

/**
 * Decodes the small entity set used by legacy MySQL text exports.
 *
 * @param value - Legacy text value
 * @returns Value decoded once, without recursively unescaping encoded markup
 */
export function decodeBasicLegacyEntities(value: string): string {
  return value.replaceAll(/&(#39|amp|gt|lt|quot);/gu, (_, entity: string) =>
    basicLegacyEntityReplacement(entity)
  );
}

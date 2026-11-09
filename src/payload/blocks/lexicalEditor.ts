import type { FeatureProviderServer } from '@payloadcms/richtext-lexical';
import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical';

const REPLACED_FEATURE_KEYS = ['heading', 'toolbarFixed', 'toolbarInline'];

function withoutKeys(
  features: FeatureProviderServer[],
  keys: readonly string[]
): FeatureProviderServer[] {
  return features.filter((feature) => !keys.includes(feature.key));
}

function limitedHeadingFeature() {
  return HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] });
}

/**
 * Lexical editor for layout blocks: root features, h2–h4, and both toolbars.
 *
 * @returns Payload lexical editor config
 */
export function blockLexicalEditor() {
  return lexicalEditor({
    features: ({ defaultFeatures, rootFeatures }) => {
      const base = rootFeatures.length > 0 ? rootFeatures : defaultFeatures;
      return [
        ...withoutKeys(base, REPLACED_FEATURE_KEYS),
        limitedHeadingFeature(),
        FixedToolbarFeature(),
        InlineToolbarFeature(),
      ];
    },
  });
}

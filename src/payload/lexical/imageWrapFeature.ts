import { createServerFeature } from '@payloadcms/richtext-lexical';

/**
 * Floats the selected Lexical upload beside text in the admin editor.
 */
export const ImageWrapFeature = createServerFeature({
  feature: {
    ClientFeature:
      '@/payload/lexical/imageWrapFeature.client#ImageWrapFeatureClient',
  },
  key: 'imageWrap',
});

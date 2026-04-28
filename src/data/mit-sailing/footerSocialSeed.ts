/** Footer social links — structure only. Copy: `en.json` → `MitSailingSite`. */

export type SocialNetwork =
  | 'tiktok'
  | 'instagram'
  | 'github'
  | 'facebook'
  | 'x';

type SocialLinkAriaKey =
  | 'footer_social_aria_tiktok_recreational'
  | 'footer_social_aria_instagram_recreational'
  | 'footer_social_aria_github_recreational'
  | 'footer_social_aria_facebook_recreational'
  | 'footer_social_aria_x_recreational'
  | 'footer_social_aria_facebook_varsity'
  | 'footer_social_aria_instagram_varsity';

export type FooterSocialLink = {
  readonly href: string;
  readonly ariaLabelKey: SocialLinkAriaKey;
  readonly network: SocialNetwork;
};

type RecreationalOrVarsity = 'recreational' | 'varsity';

type GroupLabelKey = `footer_social_group_${RecreationalOrVarsity}`;
type GroupAriaKey = `footer_social_group_${RecreationalOrVarsity}_aria`;

type FooterSocialGroup = {
  readonly groupLabelKey: GroupLabelKey;
  readonly groupAriaLabelKey: GroupAriaKey;
  readonly links: readonly FooterSocialLink[];
};

export const footerSocialGroups: readonly FooterSocialGroup[] = [
  {
    groupLabelKey: 'footer_social_group_recreational',
    groupAriaLabelKey: 'footer_social_group_recreational_aria',
    links: [
      {
        href: 'https://www.tiktok.com/discover/mit-sailing',
        ariaLabelKey: 'footer_social_aria_tiktok_recreational',
        network: 'tiktok',
      },
      {
        href: 'https://www.instagram.com/mitsailingpavilion',
        ariaLabelKey: 'footer_social_aria_instagram_recreational',
        network: 'instagram',
      },
      {
        href: 'https://github.com/mitsailing',
        ariaLabelKey: 'footer_social_aria_github_recreational',
        network: 'github',
      },
      {
        href: 'https://www.facebook.com/MIT.Sailing.Pavilion',
        ariaLabelKey: 'footer_social_aria_facebook_recreational',
        network: 'facebook',
      },
      {
        href: 'https://x.com/mitsailing',
        ariaLabelKey: 'footer_social_aria_x_recreational',
        network: 'x',
      },
    ],
  },
  {
    groupLabelKey: 'footer_social_group_varsity',
    groupAriaLabelKey: 'footer_social_group_varsity_aria',
    links: [
      {
        href: 'https://www.facebook.com/MITvarsitysailing',
        ariaLabelKey: 'footer_social_aria_facebook_varsity',
        network: 'facebook',
      },
      {
        href: 'https://www.instagram.com/mitsailing/',
        ariaLabelKey: 'footer_social_aria_instagram_varsity',
        network: 'instagram',
      },
    ],
  },
] as const;

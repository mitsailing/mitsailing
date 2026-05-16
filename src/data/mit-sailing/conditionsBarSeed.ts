/**
 * Conditions strip — utility link routes/keys only. Weather line copy + order: `en.json` (`MitSailingSite`) + `WeatherConditionsBar` row keys.
 */
export const conditionsBarUtilityLinks = [
  {
    labelKey: 'util_reserve_pavilion' as const,
    href: '/reserve' as const,
  },
  { labelKey: 'util_directions' as const, href: '/contact' as const },
  { labelKey: 'util_donate' as const, href: '/donate' as const },
] as const;

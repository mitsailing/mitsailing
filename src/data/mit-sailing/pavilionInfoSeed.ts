/** Pavilion hours, phone, and locations (seed / dummy data for UI). */

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const pavilionHours = {
  sectionTitle: 'Pavilion Hours',
  seasonSubtitle: 'Open 7 days a week · April 1 – November 15',
  schedule: [
    { day: 'Monday', hours: '3:00 pm – Sunset' },
    { day: 'Tuesday', hours: 'Noon – Sunset' },
    { day: 'Wednesday', hours: 'Noon – Sunset' },
    { day: 'Thursday', hours: 'Noon – Sunset' },
    { day: 'Friday', hours: 'Noon – Sunset' },
    { day: 'Saturday', hours: 'Noon – Sunset' },
    { day: 'Sunday', hours: 'Noon – Sunset' },
  ] as const,
} as const;

export const pavilionPhone = {
  display: '617.253.4884',
  telHref: 'tel:+16172534884',
} as const;

export type PavilionAddressBlock = {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly string[];
  readonly mapsUrl: string;
  /** Shown below the address (e.g. delivery warnings). */
  readonly notes?: readonly string[];
};

export const pavilionStreetAddress: PavilionAddressBlock = {
  id: 'street',
  title: 'Street address',
  lines: [
    'Walter C. Wood Sailing Pavilion',
    'Massachusetts Institute of Technology',
    'Building 51',
    '134 Memorial Dr',
    'Cambridge, MA',
  ],
  mapsUrl: mapsSearchUrl(
    'Walter C. Wood Sailing Pavilion, Building 51, 134 Memorial Drive, Cambridge, MA'
  ),
  notes: [
    'Bluewater sailing events on Mashnee use a different location. The linked address and directions for that venue appear below in this section.',
    'Do not send mail or packages to this address. Delivery services will not deliver here.',
  ],
};

export const pavilionShippingAddress: PavilionAddressBlock = {
  id: 'shipping',
  title: 'Shipping address',
  lines: ['MIT Sailing Pavilion', '3 Ames St', 'Cambridge, MA 02142'],
  mapsUrl: mapsSearchUrl(
    'MIT Sailing Pavilion, 3 Ames St, Cambridge, MA 02142'
  ),
};

export const pavilionLegalAddress: PavilionAddressBlock = {
  id: 'legal',
  title: 'Legal address',
  lines: [
    'Walter C. Wood Sailing Pavilion',
    'Massachusetts Institute of Technology',
    'Building 51',
    '77 Massachusetts Ave',
    'Cambridge, MA 02139',
  ],
  mapsUrl: mapsSearchUrl(
    'MIT Building 51 Sailing Pavilion, 77 Massachusetts Ave, Cambridge, MA 02139'
  ),
};

export const pavilionDirections = {
  title: 'Directions to the MIT Sailing Pavilion',
  summary:
    'The Walter C. Wood Sailing Pavilion is MIT Building 51 on Memorial Drive, across from Walker Memorial. Parking on Memorial Drive is limited, so transit to Kendall/MIT is usually the simplest option.',
  steps: [
    'Use the street address for walking, transit, rideshare, or map directions to the Pavilion.',
    'From Kendall/MIT, walk south through campus toward Walker Memorial, then cross Memorial Drive to the river side.',
    'If you drive, plan extra time for Cambridge parking and construction changes near Memorial Drive.',
  ],
  ctaLabel: 'Open Pavilion map',
  mapsUrl: pavilionStreetAddress.mapsUrl,
} as const;

/** Mashnee — MIT Bluewater Sailing events (separate location from the Charles River pavilion). */
export const mashneeBluewaterLocation = {
  title: 'Mashnee — Bluewater sailing events',
  summary:
    'Mashnee is berthed at Boston Waterboat Marina near Long Wharf. Bluewater sailing events meet there, not at the Walter C. Wood Sailing Pavilion on the Charles River.',
  lines: [
    'Boston Waterboat Marina',
    '66 Long Wharf',
    'Boston, MA 02110',
  ] as const,
  mapsUrl: mapsSearchUrl('Boston Waterboat Marina, Long Wharf, Boston, MA'),
} as const;

export const mashneeDirections = {
  title: 'Directions to Mashnee',
  warning:
    'Mashnee is kept at Boston Waterboat Marina near Long Wharf. Bluewater/Mashnee events do not meet at the MIT Sailing Pavilion on Memorial Drive.',
  walkingTitle: 'Walking from the MBTA',
  walkingSteps: [
    'Take the Blue Line to Aquarium, the closest MBTA station to Boston Waterboat Marina.',
    'Head toward Long Wharf, just north of the New England Aquarium.',
    'Look for the long red-brick Marriott building, continue past the Chart House, then turn left into the parking area behind it.',
    'The Boston Waterboat Marina entrance is on the right, marked by a fence near the marina gate.',
  ],
  parkingTitle: 'Parking near Long Wharf',
  parkingNotes: [
    'Most nearby meters run into the evening on weekdays and Saturdays. Read posted signs carefully.',
    'Street parking is sometimes available in the Financial District around High Street, India Street, and Broad Street, especially evenings and weekends.',
    'Nearby garages and lots change rates frequently. One International Place and Seaport/Northern Avenue lots are common backups, but check current pricing before you leave your car.',
    'Weekend and overnight trips can trigger different parking rules, so confirm the lot allows the full time you need.',
  ],
  ctaLabel: 'Open Waterboat Marina map',
  mapsUrl: mashneeBluewaterLocation.mapsUrl,
} as const;

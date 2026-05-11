import type React from 'react';

/**
 * Events segment pass-through; list and detail pages choose their own content width.
 *
 * @param props - Layout props
 * @returns Child routes
 */
export default function EventsRoutesLayout(props: {
  children: React.ReactNode;
}): React.ReactNode {
  return props.children;
}

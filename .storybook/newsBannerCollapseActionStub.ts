/**
 * Storybook no-op for the news-banner collapse Server Action.
 * Keeps `next/headers` out of the browser test bundle.
 *
 * @param _signature Current banner signature when collapsing, or null when opening
 * @returns Resolved promise with no side effects
 */
export async function setNewsBannerCollapsed(_signature: string | null) {
  await Promise.resolve();
}

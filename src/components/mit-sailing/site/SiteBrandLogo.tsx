import Image from 'next/image';

/**
 * Official MIT Sailing lockup. One compact height everywhere so the header,
 * auth column, and onboarding task bar match. Swaps to the on-dark asset when
 * the document is in dark mode. Decorative; the parent link supplies the
 * accessible name.
 *
 * @returns Logo images for light and dark themes
 */
export function SiteBrandLogo() {
  return (
    <>
      <Image
        alt=""
        className="h-8 w-auto dark:hidden"
        height={32}
        src="/assets/images/logo.svg"
        unoptimized
        width={160}
      />
      <Image
        alt=""
        className="hidden h-8 w-auto dark:block dark:[filter:drop-shadow(0_0_0.5px_rgb(255_255_255/0.85))]"
        height={32}
        src="/assets/images/logo-on-dark.svg"
        unoptimized
        width={160}
      />
    </>
  );
}

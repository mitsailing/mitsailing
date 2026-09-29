import Image from 'next/image';

type SiteBrandLogoProps = {
  label: string;
};

/**
 * Official MIT Sailing lockup. One compact height everywhere so the header,
 * auth column, and onboarding task bar match. Swaps to the on-dark asset when
 * the document is in dark mode.
 *
 * @param props - Accessible name
 * @returns Logo image
 */
export function SiteBrandLogo(props: SiteBrandLogoProps) {
  return (
    <>
      <Image
        alt={props.label}
        className="h-8 w-auto dark:hidden"
        height={32}
        src="/assets/images/logo.svg"
        unoptimized
        width={160}
      />
      <Image
        alt={props.label}
        className="hidden h-8 w-auto dark:block dark:[filter:drop-shadow(0_0_0.5px_rgb(255_255_255/0.85))]"
        height={32}
        src="/assets/images/logo-on-dark.svg"
        unoptimized
        width={160}
      />
    </>
  );
}

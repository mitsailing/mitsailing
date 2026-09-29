import Image from 'next/image';

type SiteBrandLogoProps = {
  label: string;
};

/**
 * Official MIT Sailing lockup. One compact height everywhere so the header,
 * auth column, and onboarding task bar match.
 *
 * @param props - Accessible name
 * @returns Logo image
 */
export function SiteBrandLogo(props: SiteBrandLogoProps) {
  return (
    <Image
      alt={props.label}
      className="h-8 w-auto"
      height={32}
      src="/assets/images/logo.svg"
      unoptimized
      width={160}
    />
  );
}

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
    // eslint-disable-next-line @next/next/no-img-element -- SVG lockup needs intrinsic width from the file
    <img
      alt={props.label}
      className="h-8 w-auto"
      src="/assets/images/logo.svg"
    />
  );
}

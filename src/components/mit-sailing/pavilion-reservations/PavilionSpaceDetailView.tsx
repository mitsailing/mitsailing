import { getTranslations } from 'next-intl/server';
import { PavilionSpaceGallery } from '@/components/mit-sailing/pavilion-reservations/PavilionSpaceGallery';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import type { PavilionReservableItemDto } from '@/libs/mit-sailing/pavilionReservationTypes';

type PavilionSpaceDetailViewProps = {
  readonly locale: string;
  readonly space: PavilionReservableItemDto;
};

/**
 * Public detail layout for a pavilion space (gallery + description + reserve CTA).
 *
 * @param props - Locale and space DTO
 * @returns Space detail page body
 */
export async function PavilionSpaceDetailView(
  props: PavilionSpaceDetailViewProps
) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'PavilionSpacePage',
  });
  const tRoutes = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingRoutes',
  });

  return (
    <SiteSectionShell
      locale={props.locale}
      segments={[
        {
          href: '/reserve',
          label: tRoutes('section_reserve_pavilion'),
        },
        { label: props.space.name },
      ]}
    >
      <SiteSectionMain maxWidth="5xl" variant="catalog">
        <article className="flex flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="font-mit-serif text-3xl font-semibold text-balance text-mit-text md:text-4xl">
              {props.space.name}
            </h1>
            <p className="max-w-3xl text-base whitespace-pre-wrap text-muted-foreground md:text-lg">
              {props.space.description}
            </p>
            <div>
              <Button asChild variant="mit">
                <Link href="/reserve">{t('request_this_space')}</Link>
              </Button>
            </div>
          </header>
          <PavilionSpaceGallery
            alt={props.space.name}
            media={props.space.media}
          />
        </article>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}

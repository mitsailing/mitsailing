import { getTranslations } from 'next-intl/server';
import { adminCatalogResourceAssociationPath } from '@/libs/admin/catalog/adminCatalogPaths';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';

type SailingClassEditAssociationsProps = {
  locale: string;
  classId: string;
};

/**
 * Preview of curriculum links plus navigation to full association admin routes.
 *
 * @param props - Locale and sailing class id
 * @returns Secondary panel on the sailing class edit page
 */
export async function SailingClassEditAssociations(
  props: SailingClassEditAssociationsProps
) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminCatalogResource',
  });

  const [relatedPreview, prereqPreview, boatsPreview] = await Promise.all([
    prisma.sailingClassRelatedEvent.findMany({
      where: { sailingClassId: props.classId },
      take: 5,
      orderBy: { event: { name: 'asc' } },
      select: { event: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.sailingClassPrerequisite.findMany({
      where: { sailingClassId: props.classId },
      take: 5,
      orderBy: { prerequisiteClass: { name: 'asc' } },
      select: {
        prerequisiteClass: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.sailingClassUnlockedBoat.findMany({
      where: { sailingClassId: props.classId },
      take: 5,
      orderBy: { fleetBoat: { name: 'asc' } },
      select: {
        fleetBoat: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  function assocHref(segment: string): string {
    return adminCatalogResourceAssociationPath(
      'sailing_classes',
      props.classId,
      segment
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-mit-text">
        {t('assoc_panel_heading')}
      </h2>

      <div className="mt-6 grid gap-8 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-mit-text">
            {t('assoc_related_events_intro')}
          </p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-mit-text">
            {relatedPreview.length === 0 ? (
              <li className="list-none pl-0 text-sm text-mit-text">
                {t('assoc_empty')}
              </li>
            ) : (
              relatedPreview.map((row) => (
                <li key={row.event.id}>{row.event.name}</li>
              ))
            )}
          </ul>
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline"
            href={assocHref('related-events')}
          >
            {t('assoc_manage_related_events')}
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-mit-text">
            {t('assoc_prerequisites_intro')}
          </p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-mit-text">
            {prereqPreview.length === 0 ? (
              <li className="list-none pl-0 text-sm text-mit-text">
                {t('assoc_empty')}
              </li>
            ) : (
              prereqPreview.map((row) => (
                <li key={row.prerequisiteClass.id}>
                  {row.prerequisiteClass.name}
                </li>
              ))
            )}
          </ul>
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline"
            href={assocHref('prerequisites')}
          >
            {t('assoc_manage_prerequisites')}
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-mit-text">
            {t('assoc_unlocked_boats_intro')}
          </p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-mit-text">
            {boatsPreview.length === 0 ? (
              <li className="list-none pl-0 text-sm text-mit-text">
                {t('assoc_empty')}
              </li>
            ) : (
              boatsPreview.map((row) => (
                <li key={row.fleetBoat.id}>{row.fleetBoat.name}</li>
              ))
            )}
          </ul>
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline"
            href={assocHref('unlocked-boats')}
          >
            {t('assoc_manage_unlocked_boats')}
          </Link>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { updatePavilionReservationAdminAction } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminActions';
import {
  adminPavilionReservationIndexPath,
  adminPavilionReservationDetailPath,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import {
  adminPavilionReservationStatuses,
  getAdminPavilionReservationById,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import { Link } from '@/libs/I18nNavigation';
import {
  formatEasternDateTime,
  formatEasternShortDateFromIsoCalendar,
} from '@/libs/mit-sailing/easternTimeFormat';
import { formatPavilionReservationMoney } from '@/libs/mit-sailing/pavilionReservationPricing';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';

type AdminPavilionReservationDetailPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

function dateLabel(date: Date): string {
  return formatEasternShortDateFromIsoCalendar(date.toISOString().slice(0, 10));
}

function MoneyCell(props: { amountCents: number | null; tbd: string }) {
  return props.amountCents === null
    ? props.tbd
    : formatPavilionReservationMoney(props.amountCents);
}

export async function generateMetadata(
  props: AdminPavilionReservationDetailPageProps
): Promise<Metadata> {
  const { id, locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_pavilion_reservation', { id }) };
}

export default async function AdminPavilionReservationDetailPage(
  props: AdminPavilionReservationDetailPageProps
) {
  const { id, locale } = await props.params;
  setRequestLocale(locale);
  const [reservation, t] = await Promise.all([
    getAdminPavilionReservationById(id),
    getTranslations({ locale, namespace: 'AdminPavilionReservations' }),
  ]);

  if (!reservation) {
    notFound();
  }

  const action = updatePavilionReservationAdminAction.bind(null, locale, id);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link
          className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
          href={adminPavilionReservationIndexPath()}
        >
          {t('action_back_to_list')}
        </Link>
      </div>

      <AdminPageHeader
        title={t('detail_title', { reference: reservation.referenceCode })}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_contact')}
            </h2>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_name')}
                </dt>
                <dd className="font-semibold text-mit-text">
                  {reservation.firstName} {reservation.lastName}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_email')}
                </dt>
                <dd>{reservation.requesterEmail}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_phone')}
                </dt>
                <dd>{reservation.phone}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_persona')}
                </dt>
                <dd>{t(`persona_${reservation.persona}`)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_event')}
            </h2>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_event_name')}
                </dt>
                <dd className="font-semibold text-mit-text">
                  {reservation.eventName}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_group_name')}
                </dt>
                <dd>{reservation.groupName ?? t('blank')}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_group_size')}
                </dt>
                <dd>{reservation.groupSize ?? t('blank')}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_tent')}
                </dt>
                <dd>{reservation.hasTent ? t('yes') : t('no')}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_alcohol')}
                </dt>
                <dd>{reservation.servesAlcohol ? t('yes') : t('no')}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium text-muted-foreground">
                  {t('field_description')}
                </dt>
                <dd className="whitespace-pre-wrap">
                  {reservation.description}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_reservation')}
            </h2>
            <div className="mt-4 space-y-4">
              {reservation.slots.map((slot) => (
                <div
                  className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                  key={slot.id}
                >
                  <div className="font-semibold text-mit-text">
                    {slot.item.name}
                  </div>
                  <div className="mt-1 text-mit-readable-ink">
                    {dateLabel(slot.requestedDate)} ·{' '}
                    {formatPavilionReservationTimeLabel(slot.startMinutes)} -{' '}
                    {formatPavilionReservationTimeLabel(slot.endMinutes)}
                  </div>
                  <div className="mt-1 font-medium text-primary-ink">
                    <MoneyCell
                      amountCents={slot.estimatedAmountCents}
                      tbd={t('price_tbd')}
                    />
                  </div>
                </div>
              ))}
              {reservation.services.map((service) => (
                <div
                  className="rounded-lg border border-border bg-muted/30 p-3 text-sm"
                  key={service.id}
                >
                  <div className="font-semibold text-mit-text">
                    {service.item.name}
                  </div>
                  <div className="mt-1 font-medium text-primary-ink">
                    <MoneyCell
                      amountCents={service.estimatedAmountCents}
                      tbd={t('price_tbd')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_status')}
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('column_status')}
                </dt>
                <dd>{t(`status_${reservation.status}`)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('column_estimate')}
                </dt>
                <dd>
                  <MoneyCell
                    amountCents={reservation.estimatedTotalCents}
                    tbd={t('price_tbd')}
                  />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_created_at')}
                </dt>
                <dd>{formatEasternDateTime(reservation.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">
                  {t('field_reviewed_by')}
                </dt>
                <dd>
                  {reservation.reviewedBy
                    ? reservation.reviewedBy.name
                    : t('blank')}
                </dd>
              </div>
            </dl>
          </section>

          <form
            action={action}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_admin_update')}
            </h2>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">
                {t('filter_status_label')}
              </span>
              <select
                className={adminNativeSelectClassName}
                defaultValue={reservation.status}
                name="status"
              >
                {adminPavilionReservationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`status_${status}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-foreground">
                {t('field_admin_notes')}
              </span>
              <Textarea
                defaultValue={reservation.adminNotes ?? ''}
                name="adminNotes"
                rows={5}
              />
            </label>
            <Button type="submit" variant="mit">
              {t('action_save')}
            </Button>
          </form>
        </aside>
      </div>

      <div>
        <Link
          className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
          href={adminPavilionReservationDetailPath(reservation.id)}
        >
          {t('action_permalink')}
        </Link>
      </div>
    </div>
  );
}

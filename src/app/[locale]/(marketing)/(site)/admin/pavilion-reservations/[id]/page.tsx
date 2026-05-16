import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Form from 'next/form';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatNyDateTimeLocalInput } from '@/lib/mit-sailing/nyTime';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { updatePavilionReservationAdminAction } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminActions';
import {
  adminPavilionReservationDetailPath,
  adminPavilionReservationIndexPath,
  validateAdminPavilionReservationHref,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import {
  adminPavilionReservationPaymentStatuses,
  adminPavilionReservationStatuses,
  getAdminPavilionReservationById,
  listAdminPavilionReservableItemOptions,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import { adminPavilionReservationDateKey } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminSchedule';
import { Link } from '@/libs/I18nNavigation';
import {
  formatEasternDateTime,
  formatEasternShortDateFromIsoCalendar,
} from '@/libs/mit-sailing/easternTimeFormat';
import { buildPavilionReservationTimeSelectOptions } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import {
  formatPavilionReservationMoney,
  PAVILION_RESERVATION_PERSONAS,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';

type AdminPavilionReservationDetailPageProps = {
  params: Promise<{ id: string; locale: string }>;
};

function dollarsValue(amountCents: number | null): string {
  return amountCents === null ? '' : String(amountCents / 100);
}

function TimeSelect(props: {
  blank?: string;
  defaultValue?: number;
  formatOffGridTimeLabel?: (minutes: number) => string;
  includeEnd?: boolean;
  name: string;
}) {
  const options = buildPavilionReservationTimeSelectOptions({
    includeEnd: props.includeEnd,
    preserveMinutes: props.defaultValue,
    preserveLabel: props.formatOffGridTimeLabel,
  });
  return (
    <select
      className={adminNativeSelectClassName}
      defaultValue={props.defaultValue?.toString() ?? ''}
      name={props.name}
    >
      {props.blank ? <option value="">{props.blank}</option> : null}
      {options.map((option) => (
        <option key={option.minutes} value={option.minutes}>
          {option.label}
        </option>
      ))}
    </select>
  );
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
  const [reservation, itemOptions, t] = await Promise.all([
    getAdminPavilionReservationById(id),
    listAdminPavilionReservableItemOptions(),
    getTranslations({ locale, namespace: 'AdminPavilionReservations' }),
  ]);

  if (!reservation) {
    notFound();
  }

  const action = updatePavilionReservationAdminAction.bind(null, locale, id);
  const spaceOptions = itemOptions.filter((item) => item.kind === 'space');
  const serviceOptions = itemOptions.filter((item) => item.kind === 'service');
  const selectedServiceByItemId = new Map(
    reservation.services.map((service) => [service.item.id, service])
  );

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
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

      <Form action={action} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <input
          name="updatedAt"
          type="hidden"
          value={reservation.updatedAt.toISOString()}
        />
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_contact')}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_first_name')}</span>
                <Input defaultValue={reservation.firstName} name="firstName" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_last_name')}</span>
                <Input defaultValue={reservation.lastName} name="lastName" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_email')}</span>
                <Input
                  defaultValue={reservation.requesterEmail}
                  name="requesterEmail"
                  type="email"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_phone')}</span>
                <Input defaultValue={reservation.phone} name="phone" />
              </label>
              <label className="space-y-1.5 text-sm md:col-span-2">
                <span className="font-medium">{t('field_persona')}</span>
                <select
                  className={adminNativeSelectClassName}
                  defaultValue={reservation.persona}
                  name="persona"
                >
                  {PAVILION_RESERVATION_PERSONAS.map((persona) => (
                    <option key={persona} value={persona}>
                      {t(`persona_${persona}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_event')}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_event_name')}</span>
                <Input defaultValue={reservation.eventName} name="eventName" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_group_name')}</span>
                <Input
                  defaultValue={reservation.groupName ?? ''}
                  name="groupName"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t('field_group_size')}</span>
                <Input
                  defaultValue={reservation.groupSize ?? ''}
                  min="1"
                  name="groupSize"
                  type="number"
                />
              </label>
              <div className="flex items-end gap-6 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    defaultChecked={reservation.hasTent}
                    name="hasTent"
                    type="checkbox"
                  />
                  <span>{t('field_tent')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    defaultChecked={reservation.servesAlcohol}
                    name="servesAlcohol"
                    type="checkbox"
                  />
                  <span>{t('field_alcohol')}</span>
                </label>
              </div>
              <label className="space-y-1.5 text-sm md:col-span-2">
                <span className="font-medium">{t('field_description')}</span>
                <Textarea
                  defaultValue={reservation.description}
                  name="description"
                  rows={5}
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_mit_billing')}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(
                [
                  [
                    'projectTitle',
                    'field_project_title',
                    reservation.projectTitle,
                  ],
                  [
                    'advisorName',
                    'field_advisor_name',
                    reservation.advisorName,
                  ],
                  [
                    'advisorEmail',
                    'field_advisor_email',
                    reservation.advisorEmail,
                  ],
                  ['costCenter', 'field_cost_center', reservation.costCenter],
                  ['mitId', 'field_mit_id', reservation.mitId],
                  ['mitAccount', 'field_mit_account', reservation.mitAccount],
                ] as const
              ).map(([name, label, value]) => (
                <label className="space-y-1.5 text-sm" key={name}>
                  <span className="font-medium">{t(label)}</span>
                  <Input defaultValue={value ?? ''} name={name} />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_reservation')}
            </h2>
            <div className="mt-4 space-y-4">
              {reservation.slots.map((slot) => (
                <div
                  className="rounded-lg border border-border bg-muted/30 p-3"
                  key={slot.id}
                >
                  <input name="slotId" type="hidden" value={slot.id} />
                  <label className="mb-3 flex items-center gap-2 text-sm text-mit-readable-ink">
                    <input
                      name="removeSlotId"
                      type="checkbox"
                      value={slot.id}
                    />
                    <span>{t('action_remove_slot')}</span>
                  </label>
                  <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">{t('field_space')}</span>
                      <select
                        className={adminNativeSelectClassName}
                        defaultValue={slot.item.id}
                        name="slotItemId"
                      >
                        {spaceOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">{t('field_date')}</span>
                      <Input
                        defaultValue={adminPavilionReservationDateKey(
                          slot.requestedDate
                        )}
                        name="slotDate"
                        type="date"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">{t('field_start')}</span>
                      <TimeSelect
                        defaultValue={slot.startMinutes}
                        formatOffGridTimeLabel={(minutes) =>
                          t('time_off_grid_option', {
                            time: formatPavilionReservationTimeLabel(minutes),
                          })
                        }
                        name="slotStart"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">{t('field_end')}</span>
                      <TimeSelect
                        defaultValue={slot.endMinutes}
                        formatOffGridTimeLabel={(minutes) =>
                          t('time_off_grid_option', {
                            time: formatPavilionReservationTimeLabel(minutes),
                          })
                        }
                        includeEnd
                        name="slotEnd"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">{t('field_amount')}</span>
                      <Input
                        defaultValue={dollarsValue(slot.estimatedAmountCents)}
                        min="0"
                        name="slotAmount"
                        step="1"
                        type="number"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-mit-readable-ink">
                    {formatEasternShortDateFromIsoCalendar(
                      adminPavilionReservationDateKey(slot.requestedDate)
                    )}{' '}
                    {formatPavilionReservationTimeLabel(slot.startMinutes)} -{' '}
                    {formatPavilionReservationTimeLabel(slot.endMinutes)} ·{' '}
                    <MoneyCell
                      amountCents={slot.estimatedAmountCents}
                      tbd={t('price_tbd')}
                    />
                  </p>
                  {slot.conflictSeverity ? (
                    <p className="mt-2 text-xs font-medium text-mit-red dark:text-mit-red-ink">
                      {t(`conflict_${slot.conflictSeverity}`)}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="rounded-lg border border-dashed border-border p-3">
                <p className="text-sm font-medium text-mit-text">
                  {t('new_slot_title')}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">{t('field_space')}</span>
                    <select
                      className={adminNativeSelectClassName}
                      name="slotItemId"
                    >
                      <option value="">{t('blank')}</option>
                      {spaceOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">{t('field_date')}</span>
                    <Input name="slotDate" type="date" />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">{t('field_start')}</span>
                    <TimeSelect blank={t('blank')} name="slotStart" />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">{t('field_end')}</span>
                    <TimeSelect blank={t('blank')} includeEnd name="slotEnd" />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">{t('field_amount')}</span>
                    <Input min="0" name="slotAmount" step="1" type="number" />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_services')}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {serviceOptions.map((service) => {
                const selected = selectedServiceByItemId.get(service.id);
                return (
                  <div
                    className="rounded-md border border-border bg-background p-3"
                    key={service.id}
                  >
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        defaultChecked={Boolean(selected)}
                        name="serviceItemId"
                        type="checkbox"
                        value={service.id}
                      />
                      <span>{service.name}</span>
                    </label>
                    <input
                      name="serviceAmountItemId"
                      type="hidden"
                      value={service.id}
                    />
                    <label className="mt-2 block space-y-1.5 text-sm">
                      <span className="font-medium">{t('field_amount')}</span>
                      <Input
                        defaultValue={dollarsValue(
                          selected?.estimatedAmountCents ?? null
                        )}
                        min="0"
                        name="serviceAmount"
                        step="1"
                        type="number"
                      />
                    </label>
                  </div>
                );
              })}
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
                  {t('column_payment')}
                </dt>
                <dd>{t(`payment_${reservation.paymentStatus}`)}</dd>
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

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-mit-text">
              {t('section_admin_update')}
            </h2>
            <input name="status" type="hidden" value={reservation.status} />
            <label className="mt-4 block space-y-1.5 text-sm">
              <span className="font-medium">{t('field_payment_status')}</span>
              <select
                className={adminNativeSelectClassName}
                defaultValue={reservation.paymentStatus}
                name="paymentStatus"
              >
                {adminPavilionReservationPaymentStatuses.map(
                  (paymentStatus) => (
                    <option key={paymentStatus} value={paymentStatus}>
                      {t(`payment_${paymentStatus}`)}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="mt-4 block space-y-1.5 text-sm">
              <span className="font-medium">{t('field_paid_at')}</span>
              <Input
                defaultValue={
                  reservation.paidAt
                    ? formatNyDateTimeLocalInput(reservation.paidAt)
                    : ''
                }
                name="paidAt"
                type="datetime-local"
              />
            </label>
            <label className="mt-4 block space-y-1.5 text-sm">
              <span className="font-medium">{t('field_admin_notes')}</span>
              <Textarea
                defaultValue={reservation.adminNotes ?? ''}
                name="adminNotes"
                rows={5}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                className="col-span-2"
                name="workflowStatus"
                type="submit"
                value={reservation.status}
                variant="secondary"
              >
                {t('action_save')}
              </Button>
              {adminPavilionReservationStatuses.map((status) => (
                <Button
                  key={status}
                  name="workflowStatus"
                  type="submit"
                  value={status}
                  variant={status === 'approved' ? 'mit' : 'outline'}
                >
                  {t(`action_status_${status}`)}
                </Button>
              ))}
            </div>
          </section>
        </aside>
      </Form>

      <div>
        <Link
          className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
          href={validateAdminPavilionReservationHref(
            adminPavilionReservationDetailPath(reservation.id)
          )}
        >
          {t('action_permalink')}
        </Link>
      </div>
    </div>
  );
}

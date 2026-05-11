import { ArrowLeft, Trash2 } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import {
  AdminEventBackLink,
  adminEventFormErrorMessage,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { deleteAdminEventAction } from '@/libs/admin/events/eventAdminActions';
import {
  adminEventEditPath,
  adminEventsIndexPath,
} from '@/libs/admin/events/eventAdminPaths';
import { Link } from '@/libs/I18nNavigation';

type AdminEventDeleteTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type AdminEventDeleteViewProps = {
  errorCode: string | null;
  event: {
    name: string;
    slug: string;
    registrationCount: number;
    dateCount: number;
  };
  locale: string;
  t: AdminEventDeleteTranslations;
};

function AdminEventDeleteErrorAlert(props: {
  code: string | null;
  t: AdminEventDeleteTranslations;
}) {
  const message = adminEventFormErrorMessage(props.code, props.t);
  if (!message) {
    return null;
  }
  return (
    <p
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950"
      role="alert"
    >
      {message}
    </p>
  );
}

export function AdminEventDeleteView(props: AdminEventDeleteViewProps) {
  const deleteAction = deleteAdminEventAction.bind(
    null,
    props.locale,
    props.event.slug
  );
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <AdminEventBackLink href={adminEventsIndexPath()}>
        <ArrowLeft aria-hidden className="size-4" />
        {props.t('back_to_events')}
      </AdminEventBackLink>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{props.t('delete_title')}</CardTitle>
          <CardDescription>
            {props.t('delete_description', { name: props.event.name })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AdminEventDeleteErrorAlert code={props.errorCode} t={props.t} />
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase">
                {props.t('delete_dates')}
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {props.event.dateCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase">
                {props.t('delete_registrations')}
              </dt>
              <dd className="mt-1 font-medium tabular-nums">
                {props.event.registrationCount}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap justify-end gap-3">
            <Button asChild variant="outline">
              <Link href={adminEventEditPath(props.event.slug)}>
                {props.t('action_cancel')}
              </Link>
            </Button>
            <form action={deleteAction}>
              <Button type="submit" variant="destructive">
                <Trash2 aria-hidden className="size-4" />
                {props.t('action_confirm_delete')}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

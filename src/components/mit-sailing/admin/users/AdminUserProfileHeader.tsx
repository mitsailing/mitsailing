import { Printer } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ImpersonateButton } from '@/components/mit-sailing/admin/ImpersonateButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ADMIN_USERS_PATH,
  adminUsersEditPath,
} from '@/libs/admin/users/adminUserPaths';
import { Link } from '@/libs/I18nNavigation';

type AdminUserProfileHeaderProps = {
  readonly accountRedirectHref: string;
  readonly backHref?: string;
  readonly backLabelKey?: 'back_to_member' | 'back_to_users';
  readonly canEditUsers: boolean;
  readonly canImpersonate: boolean;
  readonly canPrintCards: boolean;
  readonly cardNumber: number | null;
  readonly cardStatusLabel: string;
  readonly currentUserId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly hasCurrentCard: boolean;
  readonly locale: string;
  readonly pdfHref: string;
  readonly phone?: string;
  readonly showEditAction?: boolean;
  readonly userId: string;
};

/**
 * Member profile header with back navigation and role-aware actions.
 *
 * @param props - Profile identity and permitted actions
 * @returns Profile header markup
 */
export async function AdminUserProfileHeader(
  props: AdminUserProfileHeaderProps
) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminUsers',
  });
  const backHref = props.backHref ?? ADMIN_USERS_PATH;
  const backLabelKey = props.backLabelKey ?? 'back_to_users';
  const showEditAction = props.showEditAction ?? true;

  return (
    <header className="border-b border-border pb-5">
      <Link
        className="text-sm font-medium text-muted-foreground hover:text-mit-red"
        href={backHref}
      >
        {t(backLabelKey)}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-2xl font-semibold text-foreground">
              {props.displayName}
            </h1>
            {props.hasCurrentCard && props.cardNumber !== null ? (
              <span className="text-2xl font-semibold text-mit-red tabular-nums">
                #{props.cardNumber}
              </span>
            ) : null}
            <Badge
              className="border-amber-200 bg-amber-50 text-amber-950"
              variant="outline"
            >
              {props.cardStatusLabel}
            </Badge>
          </div>
          {props.email || props.phone ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {props.email ? (
                <span className="font-medium text-foreground">
                  {props.email}
                </span>
              ) : null}
              {props.email && props.phone ? (
                <span aria-hidden="true"> · </span>
              ) : null}
              {props.phone ? <span>{props.phone}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.canPrintCards && props.hasCurrentCard ? (
            <Button asChild className="gap-2" size="sm" variant="mit">
              <a href={props.pdfHref} rel="noopener noreferrer" target="_blank">
                <Printer aria-hidden className="size-4" />
                {t('action_print_card')}
              </a>
            </Button>
          ) : null}
          {showEditAction && props.canEditUsers ? (
            <Button asChild size="sm" variant="outline">
              <Link href={adminUsersEditPath(props.userId)}>
                {t('action_edit')}
              </Link>
            </Button>
          ) : null}
          {props.canImpersonate && props.userId !== props.currentUserId ? (
            <ImpersonateButton
              redirectHref={props.accountRedirectHref}
              userId={props.userId}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

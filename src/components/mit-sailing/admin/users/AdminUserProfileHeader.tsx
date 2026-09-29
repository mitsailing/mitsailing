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

function AdminUserProfileActions(props: {
  readonly accountRedirectHref: string;
  readonly canEditUsers: boolean;
  readonly canImpersonate: boolean;
  readonly canPrintCards: boolean;
  readonly currentUserId: string;
  readonly editLabel: string;
  readonly hasCurrentCard: boolean;
  readonly pdfHref: string;
  readonly printLabel: string;
  readonly showEditAction: boolean;
  readonly userId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.canPrintCards && props.hasCurrentCard ? (
        <Button asChild className="gap-2" size="sm" variant="mit">
          {/* nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- PDF href is a same-origin admin card print route for this user id. */}
          <a href={props.pdfHref} rel="noopener noreferrer" target="_blank">
            <Printer aria-hidden className="size-4" />
            {props.printLabel}
          </a>
        </Button>
      ) : null}
      {props.showEditAction && props.canEditUsers ? (
        <Button asChild size="sm" variant="outline">
          <Link href={adminUsersEditPath(props.userId)}>{props.editLabel}</Link>
        </Button>
      ) : null}
      {props.canImpersonate && props.userId !== props.currentUserId ? (
        <ImpersonateButton
          redirectHref={props.accountRedirectHref}
          userId={props.userId}
        />
      ) : null}
    </div>
  );
}

function AdminUserProfileContactLine(props: {
  readonly email?: string;
  readonly phone?: string;
}) {
  if (props.email && props.phone) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{props.email}</span>
        <span aria-hidden="true"> · </span>
        <span>{props.phone}</span>
      </p>
    );
  }
  if (props.email) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{props.email}</span>
      </p>
    );
  }
  if (!props.phone) {
    return null;
  }
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      <span>{props.phone}</span>
    </p>
  );
}

function AdminUserProfileCardNumber(props: {
  readonly cardNumber: number | null;
  readonly hasCurrentCard: boolean;
}) {
  if (!props.hasCurrentCard || props.cardNumber === null) {
    return null;
  }
  return (
    <span className="text-2xl font-semibold text-mit-red tabular-nums">
      #{props.cardNumber}
    </span>
  );
}

function AdminUserProfileIdentity(props: {
  readonly cardNumber: number | null;
  readonly cardStatusLabel: string;
  readonly displayName: string;
  readonly email?: string;
  readonly hasCurrentCard: boolean;
  readonly phone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">
          {props.displayName}
        </h1>
        <AdminUserProfileCardNumber
          cardNumber={props.cardNumber}
          hasCurrentCard={props.hasCurrentCard}
        />
        <Badge
          className="border-amber-200 bg-amber-50 text-amber-950"
          variant="outline"
        >
          {props.cardStatusLabel}
        </Badge>
      </div>
      <AdminUserProfileContactLine email={props.email} phone={props.phone} />
    </div>
  );
}

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
        // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- backHref is an allowlisted admin path from the parent page.
        href={backHref}
      >
        {t(backLabelKey)}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <AdminUserProfileIdentity
          cardNumber={props.cardNumber}
          cardStatusLabel={props.cardStatusLabel}
          displayName={props.displayName}
          email={props.email}
          hasCurrentCard={props.hasCurrentCard}
          phone={props.phone}
        />
        <AdminUserProfileActions
          accountRedirectHref={props.accountRedirectHref}
          canEditUsers={props.canEditUsers}
          canImpersonate={props.canImpersonate}
          canPrintCards={props.canPrintCards}
          currentUserId={props.currentUserId}
          editLabel={t('action_edit')}
          hasCurrentCard={props.hasCurrentCard}
          pdfHref={props.pdfHref}
          printLabel={t('action_print_card')}
          showEditAction={showEditAction}
          userId={props.userId}
        />
      </div>
    </header>
  );
}

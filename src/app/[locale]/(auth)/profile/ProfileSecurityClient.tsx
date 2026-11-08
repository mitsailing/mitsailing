'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { authClient } from '@/libs/auth-client';
import { authClientThrownMessage } from '@/libs/auth/authClientThrownMessage';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';

type SecurityActivityRow = {
  readonly action: string;
  readonly createdAt: Date | string;
  readonly id: string;
  readonly severity: string;
  readonly status: string;
};

const PROFILE_SECURITY_ACTIVITY_LIMIT = 25;

function formatSecurityActivityTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(date);
}

function securityActivityRowsFromResponse(
  entries: readonly unknown[] | undefined
): SecurityActivityRow[] {
  if (!entries) {
    return [];
  }
  const rows: SecurityActivityRow[] = [];
  for (const entry of entries) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'id' in entry &&
      typeof entry.id === 'string' &&
      'action' in entry &&
      typeof entry.action === 'string' &&
      'status' in entry &&
      typeof entry.status === 'string' &&
      'severity' in entry &&
      typeof entry.severity === 'string' &&
      'createdAt' in entry &&
      (typeof entry.createdAt === 'string' || entry.createdAt instanceof Date)
    ) {
      rows.push({
        action: entry.action,
        createdAt: entry.createdAt,
        id: entry.id,
        severity: entry.severity,
        status: entry.status,
      });
    }
  }
  return rows;
}

export function ProfileSecurityClient() {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const [sessionBanner, setSessionBanner] = useState<ProfileBannerState>(null);
  const [revoking, setRevoking] = useState(false);
  const [activityRows, setActivityRows] = useState<SecurityActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSecurityActivity() {
      setActivityLoading(true);
      setActivityError(null);
      try {
        // Path `/audit-log/list` maps to `authClient.auditLog.list` via Better Auth
        // client path inference (package README still names the server endpoint).
        const res = await authClient.auditLog.list({
          query: { limit: PROFILE_SECURITY_ACTIVITY_LIMIT, offset: 0 },
        });
        if (cancelled) {
          return;
        }
        if (res.error) {
          setActivityError(t('security_activity_load_error'));
          setActivityRows([]);
          return;
        }
        const payload: unknown = res.data;
        const entries =
          typeof payload === 'object' &&
          payload !== null &&
          'entries' in payload &&
          Array.isArray(payload.entries)
            ? payload.entries
            : undefined;
        setActivityRows(securityActivityRowsFromResponse(entries));
      } catch (caughtError) {
        if (cancelled) {
          return;
        }
        reportUnknownAuthClientError({
          action: 'profile.audit-log.list.thrown',
          code: undefined,
          message: authClientThrownMessage(caughtError),
        });
        setActivityError(t('security_activity_load_error'));
        setActivityRows([]);
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    }

    // eslint-disable-next-line no-void -- fire-and-forget external Better Auth fetch inside useEffect.
    void loadSecurityActivity();

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function onRevokeSessions() {
    setSessionBanner(null);
    setRevoking(true);
    try {
      const res = await authClient.revokeOtherSessions();
      if (res.error) {
        setSessionBanner({
          kind: 'error',
          message: res.error.message ?? t('sign_out_all_error'),
        });
        return;
      }
      setSessionBanner({
        kind: 'success',
        message: t('sign_out_all_success'),
      });
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'profile.revoke-sessions.thrown',
        code: undefined,
        message: authClientThrownMessage(caughtError),
      });
      setSessionBanner({
        kind: 'error',
        message: t('sign_out_all_error'),
      });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('security_page_heading')}</h1>

      <section
        aria-labelledby="sign-out-all-heading"
        className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <h2 className="text-lg font-medium" id="sign-out-all-heading">
          {t('sign_out_all_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('sign_out_all_description')}
        </p>
        <ProfileInlineBanner banner={sessionBanner} />
        <SubmitButton
          className="mt-4 w-fit"
          onClick={() => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the revoke promise.
            void onRevokeSessions();
          }}
          pending={revoking}
          pendingLabel={tCommon('pending_submitting')}
          type="button"
          variant="outline"
        >
          {t('sign_out_all_submit')}
        </SubmitButton>
      </section>

      <section
        aria-labelledby="security-activity-heading"
        className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <h2 className="text-lg font-medium" id="security-activity-heading">
          {t('security_activity_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('security_activity_description')}
        </p>
        {activityError ? (
          <p className="mt-4 text-sm text-red-800" role="alert">
            {activityError}
          </p>
        ) : null}
        {activityLoading ? (
          <p className="mt-4 text-sm text-mit-text">
            {t('security_activity_loading')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('security_activity_column_action')}</TableHead>
                  <TableHead>{t('security_activity_column_status')}</TableHead>
                  <TableHead>
                    {t('security_activity_column_severity')}
                  </TableHead>
                  <TableHead>{t('security_activity_column_time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      {t('security_activity_empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  activityRows.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.action}
                      </TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell>{entry.severity}</TableCell>
                      <TableCell>
                        {formatSecurityActivityTime(entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

# Row change audit trail

This document defines the target audit architecture for application data changes
in MIT Sailing. It complements the existing Better Auth audit log and the narrow
catalog edit metadata work; it does not replace durable creator/editor columns
that pages need for fast display.

## Goals

- Track `INSERT`, `UPDATE`, and `DELETE` across many Prisma-backed tables.
- Record who actually caused the write, including admin impersonation.
- Capture old and new row values without hand-writing audit calls in every
  handler.
- Keep the audit trail useful after source rows are deleted or renamed.
- Avoid making product UI depend on short-retention auth/security logs.

## What not to copy

Cal.com's current audit-log documentation is a useful product reference for
actor/action/target shape, but it is oriented toward security-sensitive
organization actions rather than full table-change history. Use that shape as
inspiration, not as a direct schema copy.

The existing `AuditLog` model backs `better-auth-audit-logs` and upload security
events. It is appropriate for auth/security and operational signals. It is not a
complete row-change trail because it is action-oriented, manually emitted, and
does not automatically capture old/new table values.

The existing `CatalogChangeLog` is a catalog edit-page convenience log. It is
not the universal audit table.

## Recommended architecture

Use a Postgres trigger-backed audit trail with application context supplied by
Prisma transactions.

1. Add a dedicated audit schema and append-only row-change table.
2. Install one generic `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` trigger
   function.
3. Attach that trigger to audited application tables.
4. Wrap audited writes in a helper that sets transaction-local audit context.
5. Let the trigger write `old_values`, `new_values`, changed fields, row primary
   key, request context, and actor context.

This gives broad coverage without relying on each handler to remember a manual
`log...()` call after mutation.

## Proposed database shape

Use an audit table shaped like this, with names adjusted to the Prisma schema
when implemented:

```sql
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.row_change_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL,
  row_pk jsonb NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[] NOT NULL DEFAULT '{}',
  transaction_id bigint NOT NULL DEFAULT txid_current(),
  actor_user_id text,
  acting_as_user_id text,
  impersonator_user_id text,
  source text NOT NULL,
  request_id text,
  reason text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
```

Store source-row IDs as JSONB instead of foreign keys. Audit history must survive
deleting the row being audited and should handle composite keys later.

Start with full `old_values` and `new_values` JSONB snapshots plus
`changed_fields`. Deltas can be added later if volume makes full snapshots too
expensive. Full row snapshots are easier to debug and survive schema evolution
well.

Consider monthly partitioning by `created_at` once row volume is proven large.

## Actor context

Every audited write should carry this context:

| Field | Meaning |
| --- | --- |
| `actor_user_id` | The real authenticated user who initiated the write. During impersonation, this is the admin/operator. |
| `acting_as_user_id` | The effective user context, when a write is intentionally performed as someone else. |
| `impersonator_user_id` | Optional explicit alias for the real admin when the session is impersonating. It can equal `actor_user_id`; keeping both names makes queries obvious. |
| `source` | `WEBAPP`, `API`, `WORKER`, `CRON`, `SYSTEM`, or a similarly small enum. |
| `request_id` | Request or trace identifier shared by all audit rows from one request/job. |
| `reason` | Required for admin impersonation and other privileged support actions. |
| `context` | Small JSON object for route, resource, operation name, or job id. Do not store secrets. |

Best practice for impersonation: preserve both identities. Never attribute a
write only to the impersonated user, because that hides the operator who made
the change. When Better Auth exposes `session.session.impersonatedBy`, the audit
context should keep the real admin and the effective user separately.

## Prisma helper pattern

Do not call `process.env` or open separate database clients for audit context.
Use the existing Prisma singleton and an interactive transaction.

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`
    SELECT set_config(
      'app.audit_context',
      ${JSON.stringify(auditContext)},
      true
    )
  `;

  await tx.someModel.update({
    where: { id },
    data,
  });
});
```

The third `set_config` argument must be `true`; that makes the setting
transaction-local so pooled connections do not leak one user's context into the
next request.

Wrap this in a small helper, for example:

```ts
export async function withAuditContext<T>(props: {
  actorUserId: string | null;
  actingAsUserId?: string | null;
  impersonatorUserId?: string | null;
  source: AuditSource;
  requestId?: string | null;
  reason?: string | null;
  context?: Record<string, unknown>;
  run: (tx: Prisma.TransactionClient) => Promise<T>;
}): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setAuditContext(tx, props);
    return props.run(tx);
  });
}
```

Server Actions, Route Handlers, and workers should all use that helper for
audited writes. Bulk seed scripts and migrations can either set
`source: 'SYSTEM'` or run with auditing disabled intentionally.

## Trigger behavior

The trigger should:

- Read `current_setting('app.audit_context', true)`.
- Default missing context to `source: 'SYSTEM'` with null actor fields.
- Use `to_jsonb(OLD)` and `to_jsonb(NEW)` for row snapshots.
- For updates, skip writing an audit row when `OLD IS NOT DISTINCT FROM NEW`.
- Derive `changed_fields` by comparing old and new JSONB keys.
- Extract primary key values into `row_pk`.
- Write only to the append-only audit table.

Use `AFTER` triggers so the audit row reflects the final persisted state after
other triggers have run.

## Open-source options

- **Custom Postgres triggers**: Best fit for this app. Small operational
  surface, works with Prisma, and handles many tables.
- **Bemi**: Worth considering if we want CDC/WAL-based auditing and extra
  infrastructure. It supports Prisma context, but it is a larger architectural
  dependency.
- **pgMemento**: Mature Postgres extension for deeper history and restore-style
  workflows. More invasive than this app needs initially.
- **pgAudit**: Useful for statement/operator/security auditing. Not a product
  row-diff history because it logs SQL activity rather than old/new application
  row state.

## Relationship to page metadata

Keep row-level `createdByUserId`, `updatedByUserId`, `createdAt`, and
`updatedAt` columns where the UI needs fast creator/last-editor display. The
audit trail answers forensic questions; entity metadata answers normal product
questions.

For catalog rich text edit pages, the existing metadata sidebar can keep using
durable row metadata and a small recent-change query. When the universal audit
trail exists, `CatalogChangeLog` can either be retired or treated as a temporary
compatibility table.

## Implementation sequence

1. Add `audit.row_change_logs`, trigger functions, and helper functions in a
   Prisma migration.
2. Add `src/libs/audit/withAuditContext.ts` with the transaction helper.
3. Add an allowlist of audited tables and attach triggers table by table.
4. Update admin mutations to pass actual/effective actor context.
5. Add tests for the helper and at least one audited mutation path.
6. Add an admin read view only after retention, filtering, and authorization are
   explicit.

## References

- [Cal.com audit logs](https://cal.com/docs/developing/guides/audit-logs)
- [Bemi Prisma integration](https://docs.bemi.io/orms/prisma/)
- [pgAudit](https://github.com/pgaudit/pgaudit)
- [pgMemento](https://github.com/pgMemento/pgMemento)
- [PostgreSQL audit trigger wiki](https://wiki.postgresql.org/wiki/Audit_trigger)
- [PostgreSQL `CREATE TRIGGER`](https://www.postgresql.org/docs/current/sql-createtrigger.html)

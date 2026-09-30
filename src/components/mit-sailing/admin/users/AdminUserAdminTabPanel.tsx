import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { updateAdminUserAction } from '@/libs/admin/users/adminUserActions';
import { usersAdminEditDefinition } from '@/libs/admin/users/userAdminDefinitions';

type AdminUserAdminTabPanelProps = {
  readonly errorCode?: string;
  readonly locale: string;
  readonly row: CatalogRow;
  readonly userId: string;
};

/**
 * Admin tab form for auth-level member account controls.
 *
 * @param props - Target user row and form error state
 * @returns Admin settings form
 */
export function AdminUserAdminTabPanel(props: AdminUserAdminTabPanelProps) {
  const updateAction = updateAdminUserAction.bind(
    null,
    props.locale,
    props.userId
  );

  return (
    <div className="rounded-lg border border-mit-line bg-card p-5 shadow-sm md:p-6">
      <AdminCatalogForm
        key={`user-${props.userId}`}
        definition={usersAdminEditDefinition}
        errorCode={props.errorCode ?? null}
        formAction={updateAction}
        headingKey="edit_heading"
        messageNamespace="AdminUsers"
        row={props.row}
        suppressPageHeading
      />
    </div>
  );
}

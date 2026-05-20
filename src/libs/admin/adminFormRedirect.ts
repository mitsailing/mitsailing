export const ADMIN_FORM_REDIRECT_TO_FIELD = 'redirectTo';
export const ADMIN_FORM_REDIRECT_TO_EDIT = 'edit';

export function adminFormReturnsToEdit(formData: FormData): boolean {
  return (
    formData.get(ADMIN_FORM_REDIRECT_TO_FIELD) === ADMIN_FORM_REDIRECT_TO_EDIT
  );
}

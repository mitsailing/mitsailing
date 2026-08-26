export type FormValidationSummaryEntry = {
  controlId: string;
  label: string;
  message: string;
};

function isFormFieldControl(
  element: Element
): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

/**
 * Returns visible label text for a form control from its associated label or
 * aria-label.
 *
 * @param control - Form control element
 * @returns Label text or the control name
 */
export function getFormControlLabel(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): string {
  if (control.id) {
    const label = control.ownerDocument.querySelector(
      `label[for="${CSS.escape(control.id)}"]`
    );
    if (label?.textContent?.trim()) {
      return label.textContent.trim();
    }
  }

  const ariaLabel = control.getAttribute('aria-label')?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }

  return control.name || control.id || 'Field';
}

/**
 * Expands collapsed ancestors so a hidden invalid control can receive focus.
 *
 * @param control - Form control to reveal
 */
function revealFormControl(control: HTMLElement): void {
  let parent = control.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement && !parent.open) {
      parent.open = true;
    }
    if (parent.hasAttribute('hidden')) {
      parent.removeAttribute('hidden');
    }
    parent = parent.parentElement;
  }

  if (control.hasAttribute('hidden')) {
    control.removeAttribute('hidden');
  }
}

/**
 * Collects native validation errors from every invalid control in a form.
 *
 * @param form - Form being submitted
 * @returns Summary entries for each invalid control
 */
export function collectInvalidFormControls(
  form: HTMLFormElement
): FormValidationSummaryEntry[] {
  const entries: FormValidationSummaryEntry[] = [];

  for (const element of form.elements) {
    if (!isFormFieldControl(element)) {
      continue;
    }
    if (element.type === 'hidden' || element.disabled) {
      continue;
    }
    if (element.validity.valid) {
      continue;
    }

    revealFormControl(element);
    const controlId = element.id || element.name;
    if (!controlId) {
      continue;
    }

    element.setAttribute('aria-invalid', 'true');
    entries.push({
      controlId,
      label: getFormControlLabel(element),
      message: element.validationMessage,
    });
  }

  return entries;
}

/**
 * Focuses a form control and scrolls it into view.
 *
 * @param form - Parent form
 * @param controlId - Control id or name
 */
export function focusFormControl(
  form: HTMLFormElement,
  controlId: string
): void {
  const byId = form.querySelector(`#${CSS.escape(controlId)}`);
  const control =
    byId instanceof HTMLElement
      ? byId
      : form.querySelector(`[name="${CSS.escape(controlId)}"]`);

  if (!(control instanceof HTMLElement)) {
    return;
  }

  revealFormControl(control);
  control.focus({ preventScroll: true });
  const prefersReducedMotion = globalThis.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  control.scrollIntoView({
    block: 'center',
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

/**
 * Site convention for control invalidity after a submit/continue attempt.
 * Returns `true` only when errors are shown AND the field is currently invalid;
 * otherwise `undefined` so Input/Textarea/NativeSelect omit destructive styles.
 *
 * Composition: Headless UI `Field` + `Label` (+ `Description`). Chrome: shadcn
 * controls. Do not add shadcn `Field` — Headless is already the app dependency.
 *
 * @param props - Shown and invalid flags for the control
 * @returns `true` when invalid chrome should show, otherwise `undefined`
 */
export function ariaInvalidWhenShown(props: {
  readonly shown: boolean;
  readonly invalid: boolean;
}): true | undefined {
  return props.shown && props.invalid ? true : undefined;
}

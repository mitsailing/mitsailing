import { nameCase } from '@foundernest/namecase';

type PersonNameInput = {
  readonly firstName: string;
  readonly lastName: string;
};

const normalizeNamePart = (value: string) =>
  value.trim().replaceAll(/\s+/g, ' ');

const buildPersonName = (props: PersonNameInput) => ({
  firstName: props.firstName,
  lastName: props.lastName,
  name: `${props.firstName} ${props.lastName}`.trim(),
});

export const normalizeManualPersonName = (props: PersonNameInput) =>
  buildPersonName({
    firstName: normalizeNamePart(props.firstName),
    lastName: normalizeNamePart(props.lastName),
  });

export const normalizeVerifiedMitDataWarehousePersonName = (
  props: PersonNameInput
) =>
  buildPersonName({
    firstName: nameCase(normalizeNamePart(props.firstName), { lazy: false }),
    lastName: nameCase(normalizeNamePart(props.lastName), { lazy: false }),
  });

export const normalizeImportedPersonName = (props: PersonNameInput) =>
  buildPersonName({
    firstName: nameCase(normalizeNamePart(props.firstName), { lazy: false }),
    lastName: nameCase(normalizeNamePart(props.lastName), { lazy: false }),
  });

import * as z from 'zod';
import { PAVILION_RESERVATION_END_MINUTES } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';

const textField = z.string().trim().min(1);
const optionalTextField = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const slotSchema = z.object({
  itemId: textField,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinutes: z.number().int().min(0).max(PAVILION_RESERVATION_END_MINUTES),
  endMinutes: z.number().int().min(1).max(PAVILION_RESERVATION_END_MINUTES),
});

const slotsPayloadSchema = z
  .array(slotSchema)
  .min(1)
  .refine((slots) =>
    slots.every((slot) => slot.endMinutes > slot.startMinutes)
  );

const servicePayloadSchema = z.array(textField);

const mitIdField = optionalTextField.refine(
  (value) => value === null || /^\d{9}$/.test(value),
  { message: 'invalid_mit_id' }
);
const mitAccountField = optionalTextField.refine(
  (value) => value === null || /^\d{7}$/.test(value),
  { message: 'invalid_mit_account' }
);

const commonReservationFields = {
  requesterEmail: z.string().trim().pipe(z.email()),
  firstName: textField,
  lastName: textField,
  phone: textField,
  eventName: textField,
  groupName: optionalTextField,
  groupSize: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? Number(value) : null))
    .refine(
      (value) => value === null || (Number.isInteger(value) && value > 0)
    ),
  description: textField,
  hasTent: z.boolean(),
  servesAlcohol: z.boolean(),
  mitId: mitIdField,
  mitAccount: mitAccountField,
  slots: slotsPayloadSchema,
  services: servicePayloadSchema,
};

const mitAcademicReservationSchema = z.object({
  ...commonReservationFields,
  persona: z.literal('mit_academic'),
  projectTitle: textField,
  advisorName: textField,
  advisorEmail: z.string().trim().pipe(z.email()),
  costCenter: textField,
});

const nonAcademicReservationSchema = z.object({
  ...commonReservationFields,
  persona: z.enum(['mit_student', 'mit_community', 'non_mit']),
  projectTitle: optionalTextField,
  advisorName: optionalTextField,
  advisorEmail: optionalTextField,
  costCenter: optionalTextField,
});

export const pavilionReservationFormSchema = z.discriminatedUnion('persona', [
  mitAcademicReservationSchema,
  nonAcademicReservationSchema,
]);

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function formBoolean(formData: FormData, key: string): boolean {
  return formValue(formData, key) === 'true';
}

function parseJsonPayload(value: string): unknown {
  if (!value) {
    return [];
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parsePavilionReservationFormData(formData: FormData) {
  return pavilionReservationFormSchema.safeParse({
    requesterEmail: formValue(formData, 'requesterEmail'),
    persona: formValue(formData, 'persona'),
    firstName: formValue(formData, 'firstName'),
    lastName: formValue(formData, 'lastName'),
    phone: formValue(formData, 'phone'),
    eventName: formValue(formData, 'eventName'),
    groupName: formValue(formData, 'groupName'),
    groupSize: formValue(formData, 'groupSize'),
    description: formValue(formData, 'description'),
    hasTent: formBoolean(formData, 'hasTent'),
    servesAlcohol: formBoolean(formData, 'servesAlcohol'),
    projectTitle: formValue(formData, 'projectTitle'),
    advisorName: formValue(formData, 'advisorName'),
    advisorEmail: formValue(formData, 'advisorEmail'),
    costCenter: formValue(formData, 'costCenter'),
    mitId: formValue(formData, 'mitId'),
    mitAccount: formValue(formData, 'mitAccount'),
    slots: parseJsonPayload(formValue(formData, 'slots')),
    services: parseJsonPayload(formValue(formData, 'services')),
  });
}

import * as z from 'zod';
import { Role } from '@/libs/auth/roles';

const roleSchema = z.enum(Role);

function booleanFromFormData(
  formData: FormData,
  field: 'emailVerified' | 'banned'
): boolean {
  return formData.getAll(field).includes('true');
}

export const adminUserCreateFormSchema = z.object({
  appRole: roleSchema,
  email: z.string().trim().pipe(z.email()),
  name: z.string().trim().min(1),
  password: z.string().min(8),
});

export const adminUserUpdateFormSchema = z.object({
  appRole: roleSchema,
  email: z.string().trim().pipe(z.email()),
  name: z.string().trim().min(1),
  emailVerified: z.boolean(),
  banned: z.boolean(),
  newPassword: z.string(),
});

export function rawAdminUserCreateFromFormData(formData: FormData): unknown {
  return {
    appRole: formData.get('appRole'),
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
  };
}

export function rawAdminUserUpdateFromFormData(formData: FormData): unknown {
  return {
    appRole: formData.get('appRole'),
    email: formData.get('email'),
    name: formData.get('name'),
    emailVerified: booleanFromFormData(formData, 'emailVerified'),
    banned: booleanFromFormData(formData, 'banned'),
    newPassword: formData.get('newPassword') ?? '',
  };
}

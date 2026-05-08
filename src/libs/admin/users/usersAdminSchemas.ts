import * as z from 'zod';
import { Role } from '@/libs/auth/roles';

const roleSchema = z.enum([Role.USER, Role.ADMIN]);

function booleanFromFormData(formData: FormData, field: string): boolean {
  return formData.getAll(field).includes('true');
}

export const adminUserCreateFormSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  name: z.string().trim().min(1),
  password: z.string().min(8),
  role: roleSchema,
});

export const adminUserUpdateFormSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  name: z.string().trim().min(1),
  role: roleSchema,
  emailVerified: z.boolean(),
  banned: z.boolean(),
  newPassword: z.string(),
});

export function rawAdminUserCreateFromFormData(formData: FormData): unknown {
  return {
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
    role: formData.get('role'),
  };
}

export function rawAdminUserUpdateFromFormData(formData: FormData): unknown {
  return {
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    emailVerified: booleanFromFormData(formData, 'emailVerified'),
    banned: booleanFromFormData(formData, 'banned'),
    newPassword: formData.get('newPassword') ?? '',
  };
}

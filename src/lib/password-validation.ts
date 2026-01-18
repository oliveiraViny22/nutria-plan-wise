import { z } from 'zod';

// Common weak passwords to block
const WEAK_PASSWORDS = [
  '123456',
  '12345678',
  '123456789',
  'password',
  'senha123',
  'senha1234',
  'qwerty',
  'abc123',
  'password1',
  'admin123',
  '111111',
  '000000',
  'iloveyou',
  'letmein',
  'welcome',
];

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[a-zA-Z]/, 'A senha deve conter pelo menos uma letra')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
  .refine(
    (password) => !WEAK_PASSWORDS.includes(password.toLowerCase()),
    'Esta senha é muito comum. Escolha uma senha mais forte.'
  );

// Validate password and return error message if invalid
export function validatePassword(password: string): { valid: boolean; error?: string } {
  const result = passwordSchema.safeParse(password);
  
  if (result.success) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: result.error.errors[0]?.message || 'Senha inválida',
  };
}

// Email validation schema
export const emailSchema = z
  .string()
  .trim()
  .email('E-mail inválido')
  .max(255, 'E-mail muito longo');

// Name validation schema
export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(100, 'Nome muito longo');

// Full signup validation schema
export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type SignupFormData = z.infer<typeof signupSchema>;

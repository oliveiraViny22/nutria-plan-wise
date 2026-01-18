import { z } from 'zod';

// Common weak passwords to block (expanded list)
const WEAK_PASSWORDS = [
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'senha123',
  'senha1234',
  'qwerty',
  'qwerty123',
  'abc123',
  'abcd1234',
  'admin123',
  '111111',
  '000000',
  'iloveyou',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'login',
  'admin',
  'passw0rd',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'trustno1',
  'batman',
  'superman',
  '123abc',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1q2w3e4r',
  '1qaz2wsx',
  'senha',
  'mudar123',
  'teste123',
  'usuario1',
];

// Check for sequential patterns
function hasSequentialPattern(password: string): boolean {
  const sequences = ['123', '234', '345', '456', '567', '678', '789', '890', 
                     'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
                     'ijk', 'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr',
                     'qrs', 'rst', 'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz',
                     'qwe', 'wer', 'ert', 'rty', 'tyu', 'yui', 'uio', 'iop',
                     'asd', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl',
                     'zxc', 'xcv', 'cvb', 'vbn', 'bnm'];
  const lowerPass = password.toLowerCase();
  return sequences.some(seq => lowerPass.includes(seq));
}

// Check for repeated characters
function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

// Password validation schema with enhanced rules
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[a-zA-Z]/, 'A senha deve conter pelo menos uma letra')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
  .refine(
    (password) => !WEAK_PASSWORDS.includes(password.toLowerCase()),
    'Esta senha é muito comum. Escolha uma senha mais forte.'
  )
  .refine(
    (password) => !hasSequentialPattern(password),
    'A senha não pode conter sequências óbvias (123, abc, qwerty).'
  )
  .refine(
    (password) => !hasRepeatedChars(password),
    'A senha não pode conter caracteres repetidos em sequência (aaa, 111).'
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

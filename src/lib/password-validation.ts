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

// Validate password and return detailed validation result
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: number; // 1-4
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength = 0;

  // Check minimum length
  if (password.length < 8) {
    errors.push('A senha deve ter pelo menos 8 caracteres');
  } else {
    strength++;
  }

  // Check for letters
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra');
  } else {
    strength++;
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número');
  } else {
    strength++;
  }

  // Check for special characters (bonus)
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    strength++;
  }

  // Check weak passwords
  if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Esta senha é muito comum. Escolha uma senha mais forte.');
  }

  // Check sequential patterns
  if (hasSequentialPattern(password)) {
    errors.push('A senha não pode conter sequências óbvias (123, abc, qwerty).');
  }

  // Check repeated characters
  if (hasRepeatedChars(password)) {
    errors.push('A senha não pode conter caracteres repetidos em sequência.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: Math.min(4, strength)
  };
}

// Get color for password strength indicator
export function getPasswordStrengthColor(strength: number): string {
  switch (strength) {
    case 1: return 'bg-red-500';
    case 2: return 'bg-yellow-500';
    case 3: return 'bg-blue-500';
    case 4: return 'bg-green-500';
    default: return 'bg-muted';
  }
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

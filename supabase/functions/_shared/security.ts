// Shared security utilities for edge functions

// Allowed origins for CORS - add your production domains here
const ALLOWED_ORIGINS = [
  'https://nutria-plan-wise.lovable.app',
  'https://id-preview--0d4648d3-1fe4-49fc-9711-596d3211140b.lovable.app',
  'https://preview--nutria-plan-wise.lovable.app',
  'https://0d4648d3-1fe4-49fc-9711-596d3211140b.lovableproject.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://lovable.app',
];

/**
 * Get CORS headers with origin validation
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

/**
 * Generic error messages for clients (don't expose internal details)
 */
export const CLIENT_ERRORS = {
  AUTH_REQUIRED: 'Autenticação necessária',
  AUTH_FAILED: 'Falha na autenticação',
  INVALID_REQUEST: 'Requisição inválida',
  NOT_FOUND: 'Recurso não encontrado',
  FORBIDDEN: 'Acesso negado',
  RATE_LIMIT: 'Muitas requisições, tente novamente mais tarde',
  PAYMENT_REQUIRED: 'Pagamento necessário',
  SERVER_ERROR: 'Ocorreu um erro ao processar sua requisição',
  USAGE_LIMIT: 'Limite de uso atingido',
  WEBHOOK_ERROR: 'Erro de configuração do webhook',
  INVALID_SIGNATURE: 'Assinatura inválida',
} as const;

/**
 * Simple input validation utilities
 */
export const validate = {
  isString(value: unknown): value is string {
    return typeof value === 'string';
  },
  
  isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  },
  
  isUUID(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },
  
  isEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  isEnum<T extends string>(value: unknown, allowed: T[]): value is T {
    return typeof value === 'string' && allowed.includes(value as T);
  },
  
  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  },
  
  isPositiveNumber(value: unknown): value is number {
    return this.isNumber(value) && value > 0;
  },
  
  isInRange(value: unknown, min: number, max: number): value is number {
    return this.isNumber(value) && value >= min && value <= max;
  },
  
  isArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
  },
  
  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  },
  
  maxLength(value: unknown, max: number): boolean {
    if (typeof value !== 'string') return false;
    return value.length <= max;
  },
  
  isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  },
};

/**
 * Safely extract error message for logging (never send to client)
 */
export function getErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  additionalData?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({ error: message, ...additionalData }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

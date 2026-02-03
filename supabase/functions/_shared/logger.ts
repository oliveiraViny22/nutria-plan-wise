// Structured logging utility for edge functions

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  function: string;
  message: string;
  context?: LogContext;
}

// In production, only log info, warn and error
// In development, log everything
const IS_PRODUCTION = Deno.env.get("DENO_ENV") === "production";
const MIN_LEVEL: LogLevel = IS_PRODUCTION ? "info" : "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

/**
 * Creates a structured logger for an edge function
 */
export function createLogger(functionName: string) {
  const log = (level: LogLevel, message: string, context?: LogContext) => {
    if (!shouldLog(level)) return;
    
    const structuredLog: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      function: functionName,
      message,
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    };
    
    const logString = JSON.stringify(structuredLog);
    
    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  };

  return {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),
  };
}

/**
 * Safely extract error message for logging (never send to client)
 */
export function getErrorDetails(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack?.split('\n').slice(0, 3).join('\n'),
    };
  }
  return { errorMessage: String(error) };
}

/**
 * Interface for rebalance metrics to be logged
 */
export interface RebalanceMetrics {
  iterations: number;
  convergenceTimeMs: number;
  status: 'valid' | 'valid_with_alert' | 'error' | 'structurally_invalid';
  objective: string;
  g10Status?: string;
  normalizationApplied?: boolean;
  calorieDelta?: number;
  proteinDelta?: number;
  optionsProcessed?: number;
}

/**
 * Log AI usage with optional extended metrics (for rebalancer, etc.)
 */
export async function logAIUsage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: {
    userId: string;
    functionName: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const estimatedCost = calculateEstimatedCost(
    params.model,
    params.inputTokens || 0,
    params.outputTokens || 0
  );

  try {
    await supabase.from('ai_usage_logs').insert({
      user_id: params.userId,
      function_name: params.functionName,
      model: params.model,
      input_tokens: params.inputTokens || null,
      output_tokens: params.outputTokens || null,
      success: params.success,
      error_message: params.errorMessage || null,
      estimated_cost_usd: estimatedCost,
      metadata: params.metadata || null,
    });
  } catch (err) {
    // Don't throw - logging failures shouldn't break the main flow
    console.error('[LOGGER] Failed to log AI usage:', err);
  }
}

/**
 * Estimate cost based on model and token counts
 */
function calculateEstimatedCost(model: string, inputTokens: number, outputTokens: number): number {
  // Pricing per 1M tokens (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-2.5-flash-lite': { input: 0.02, output: 0.08 },
    'google/gemini-2.5-pro': { input: 1.25, output: 5.0 },
    'google/gemini-3-flash-preview': { input: 0.10, output: 0.40 },
    'google/gemini-3-pro-preview': { input: 1.50, output: 6.0 },
    'openai/gpt-5': { input: 5.0, output: 15.0 },
    'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
    'openai/gpt-5-nano': { input: 0.05, output: 0.20 },
    // Rebalancer internal (no AI cost)
    'internal/rebalancer': { input: 0, output: 0 },
  };

  const modelPricing = pricing[model] || { input: 0.10, output: 0.40 };
  
  return (
    (inputTokens / 1_000_000) * modelPricing.input +
    (outputTokens / 1_000_000) * modelPricing.output
  );
}

// Rate limiting utilities for edge functions
// Uses database-backed tracking for distributed rate limiting

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

/**
 * Rate limit configuration per function
 */
export interface RateLimitConfig {
  /** Window size in seconds */
  windowSeconds: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Identifier for the rate limit bucket (e.g., 'ai-rebalance', 'nutritional-chat') */
  bucketName: string;
}

/**
 * Default rate limit configurations for critical functions
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'ai-rebalance': {
    windowSeconds: 60,    // 1 minute window
    maxRequests: 5,       // 5 requests per minute
    bucketName: 'ai-rebalance',
  },
  'nutritional-chat': {
    windowSeconds: 2,     // 2 second window (already exists in-code)
    maxRequests: 1,       // 1 message per 2 seconds
    bucketName: 'nutritional-chat',
  },
  'explain-substitution': {
    windowSeconds: 10,    // 10 second window
    maxRequests: 3,       // 3 requests per 10 seconds
    bucketName: 'explain-substitution',
  },
  'generate-meal-plan': {
    windowSeconds: 60,    // 1 minute window
    maxRequests: 3,       // 3 generations per minute
    bucketName: 'generate-meal-plan',
  },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
  currentCount: number;
}

/**
 * Check if a user is within rate limits using database tracking.
 * 
 * This function uses system_settings to track rate limits per user/bucket.
 * It's designed to be distributed-safe and work across multiple function instances.
 */
export async function checkRateLimit(
  supabase: AnySupabaseClient,
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - (config.windowSeconds * 1000);
  const rateLimitKey = `rate_limit:${config.bucketName}:${userId}`;

  try {
    // Get current rate limit record
    const { data: existing } = await supabase
      .from('system_settings')
      .select('value, updated_at')
      .eq('key', rateLimitKey)
      .eq('category', 'rate_limits')
      .maybeSingle();

    let currentCount = 0;
    let windowStartTime = now;

    if (existing?.value) {
      const record = existing.value as { count: number; window_start: number };
      
      // Check if we're still in the same window
      if (record.window_start && record.window_start > windowStart) {
        currentCount = record.count || 0;
        windowStartTime = record.window_start;
      }
      // If window expired, reset
    }

    // Check if allowed
    if (currentCount >= config.maxRequests) {
      const resetAfterMs = windowStartTime + (config.windowSeconds * 1000) - now;
      return {
        allowed: false,
        remaining: 0,
        resetAfterMs: Math.max(0, resetAfterMs),
        currentCount,
      };
    }

    // Increment counter
    const newCount = currentCount + 1;
    const newWindowStart = currentCount === 0 ? now : windowStartTime;

    await supabase
      .from('system_settings')
      .upsert({
        key: rateLimitKey,
        category: 'rate_limits',
        value: { count: newCount, window_start: newWindowStart },
        is_sensitive: false,
        description: `Rate limit for ${config.bucketName}`,
      }, {
        onConflict: 'key',
      });

    const resetAfterMs = newWindowStart + (config.windowSeconds * 1000) - now;

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetAfterMs: Math.max(0, resetAfterMs),
      currentCount: newCount,
    };
  } catch (error) {
    // On error, allow the request but log warning
    console.warn(`[RATE_LIMIT] Error checking rate limit for ${config.bucketName}:`, error);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAfterMs: config.windowSeconds * 1000,
      currentCount: 0,
    };
  }
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAfterMs / 1000)),
  };
}

/**
 * Helper to create rate-limited error response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  config: RateLimitConfig,
  corsHeaders: Record<string, string>
): Response {
  const retryAfterSeconds = Math.ceil(result.resetAfterMs / 1000);
  
  return new Response(
    JSON.stringify({
      error: `Limite de requisições atingido. Tente novamente em ${retryAfterSeconds} segundos.`,
      retryAfterMs: result.resetAfterMs,
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...getRateLimitHeaders(result, config),
        'Retry-After': String(retryAfterSeconds),
        'Content-Type': 'application/json',
      },
    }
  );
}

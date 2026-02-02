// =====================================================
// LOGGER DO GERADOR v5
// =====================================================

type LogLevel = "debug" | "info" | "warn" | "error";

// Em produção, só loga info, warn e error
// Em desenvolvimento, loga tudo
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

export function log(step: string, data?: unknown, level: LogLevel = "info"): void {
  if (!shouldLog(level)) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[GEN-V5] ${timestamp} | ${step}`;
  
  if (data) {
    console.log(prefix, JSON.stringify(data));
  } else {
    console.log(prefix);
  }
}

export function logDebug(step: string, data?: unknown): void {
  log(step, data, "debug");
}

export function logInfo(step: string, data?: unknown): void {
  log(step, data, "info");
}

export function logWarn(step: string, data?: unknown): void {
  log(step, data, "warn");
}

export function logError(step: string, data?: unknown): void {
  log(step, data, "error");
}

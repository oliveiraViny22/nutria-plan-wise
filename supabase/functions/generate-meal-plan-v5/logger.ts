// =====================================================
// LOGGER DO GERADOR v5
// Re-exporta o logger compartilhado com configurações específicas
// =====================================================

import { createLogger, type LogContext } from "../_shared/logger.ts";

// Criar instância do logger para o gerador v5
const logger = createLogger('generate-meal-plan-v5');

// Re-exportar com assinaturas compatíveis
export function log(step: string, data?: unknown, level: "debug" | "info" | "warn" | "error" = "info"): void {
  const context = data ? (typeof data === 'object' ? data as LogContext : { data }) : undefined;
  logger[level](`[${step}]`, context);
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

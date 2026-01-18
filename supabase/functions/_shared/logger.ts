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

/**
 * Creates a structured logger for an edge function
 */
export function createLogger(functionName: string) {
  const log = (level: LogLevel, message: string, context?: LogContext) => {
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

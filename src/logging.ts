import { randomUUID } from "node:crypto";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogContext = Record<string, unknown>;

const REDACTED_KEYS = ["authorization", "token", "pat", "password", "secret"];

function shouldRedactKey(key: string): boolean {
  return REDACTED_KEYS.some((part) => key.toLowerCase().includes(part));
}

function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 2_000 ? `${value.slice(0, 2_000)}...` : value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (shouldRedactKey(key)) {
      result[key] = "[REDACTED]";
      continue;
    }

    result[key] = sanitize(child, seen);
  }

  return result;
}

export class Logger {
  constructor(private readonly minLevel: LogLevel) {}

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  log(level: LogLevel, message: string, context: LogContext = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedContext = sanitize(context);

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(typeof sanitizedContext === "object" && sanitizedContext !== null
          ? sanitizedContext
          : {}),
      }),
    );
  }

  debug(message: string, context: LogContext = {}): void {
    this.log("debug", message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log("info", message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log("warn", message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.log("error", message, context);
  }
}

export function createCorrelationId(): string {
  return randomUUID();
}

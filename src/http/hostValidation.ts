import type { NextFunction, Request, RequestHandler, Response } from "express";

export const DEFAULT_ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  "*.ngrok-free.dev",
  "*.ngrok-free.app",
  "*.ngrok.io",
] as const;

function normalizeHostEntry(value: string): string {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return "";
  }

  const wildcardMatch = trimmed.match(/^(\*\.)https?:\/\/(.+)$/);
  if (wildcardMatch) {
    return `*.${normalizeHostEntry(wildcardMatch[2] ?? "")}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  try {
    return new URL(`http://${trimmed}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeAllowedHosts(hosts: readonly string[]): string[] {
  return Array.from(
    new Set(hosts.map(normalizeHostEntry).filter(Boolean)),
  );
}

export function isHostnameAllowed(
  hostname: string,
  allowedHosts: readonly string[],
): boolean {
  const normalizedHostname = normalizeHostEntry(hostname);

  return normalizeAllowedHosts(allowedHosts).some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1);
      return (
        normalizedHostname.length > suffix.length &&
        normalizedHostname.endsWith(suffix)
      );
    }

    return normalizedHostname === pattern;
  });
}

export function createHostValidationMiddleware(
  allowedHosts: readonly string[],
): RequestHandler {
  const normalizedAllowedHosts = normalizeAllowedHosts(allowedHosts);

  return (req: Request, res: Response, next: NextFunction) => {
    const hostHeader = req.headers.host;

    if (!hostHeader) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Missing Host header",
        },
        id: null,
      });
      return;
    }

    let hostname: string;

    try {
      hostname = new URL(`http://${hostHeader}`).hostname;
    } catch {
      res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Invalid Host header: ${hostHeader}`,
        },
        id: null,
      });
      return;
    }

    if (!isHostnameAllowed(hostname, normalizedAllowedHosts)) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Invalid Host: ${hostname}`,
        },
        id: null,
      });
      return;
    }

    next();
  };
}

import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  REQUEST_TIMEOUT_MS,
} from "./constants.js";
import { ConfigurationError, ProjectAccessError } from "./errors.js";
import {
  DEFAULT_ALLOWED_HOSTS,
  normalizeAllowedHosts,
} from "./http/hostValidation.js";
import { LOG_LEVELS, type LogLevel } from "./logging.js";

export interface AppConfig {
  readonly appName: string;
  readonly appVersion: string;
  readonly azdoOrg: string;
  readonly azdoProjectAllowlist: readonly string[];
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly allowedHosts: readonly string[];
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
}

function getRequired(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new ConfigurationError(`Missing required environment variable ${key}.`);
  }

  return value;
}

function normalizeOrgUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ConfigurationError("AZDO_ORG must not be empty.");
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    const organization = trimmed.replace(/^\/+|\/+$/g, "");
    if (!organization) {
      throw new ConfigurationError("AZDO_ORG must not be empty.");
    }

    return `https://dev.azure.com/${organization}`;
  }

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new ConfigurationError(
      "AZDO_ORG must be a valid Azure DevOps organization URL or org name, for example https://dev.azure.com/your-org or your-org",
    );
  }
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new ConfigurationError("PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) {
    return DEFAULT_LOG_LEVEL as LogLevel;
  }

  if (!LOG_LEVELS.includes(value as LogLevel)) {
    throw new ConfigurationError(
      `LOG_LEVEL must be one of: ${LOG_LEVELS.join(", ")}.`,
    );
  }

  return value as LogLevel;
}

export function parseAllowlist(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/[,\r\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseAllowedHosts(value: string | undefined): string[] {
  return normalizeAllowedHosts([
    ...DEFAULT_ALLOWED_HOSTS,
    ...parseAllowlist(value),
  ]);
}

export function normalizeProjectKey(value: string): string {
  return value.trim().toLowerCase();
}

export function isProjectAllowed(
  project: string | undefined,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): boolean {
  if (!project) {
    return false;
  }

  if (config.azdoProjectAllowlist.length === 0) {
    return true;
  }

  const normalized = normalizeProjectKey(project);
  return config.azdoProjectAllowlist.some(
    (allowedProject) => normalizeProjectKey(allowedProject) === normalized,
  );
}

export function assertProjectAllowed(
  project: string,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): void {
  if (!isProjectAllowed(project, config)) {
    throw new ProjectAccessError(project);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    azdoOrg: normalizeOrgUrl(getRequired(env, "AZDO_ORG")),
    azdoProjectAllowlist: parseAllowlist(env.AZDO_PROJECT_ALLOWLIST),
    port: parsePort(env.PORT),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    allowedHosts: parseAllowedHosts(env.ALLOWED_HOSTS),
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    retryBaseDelayMs: RETRY_BASE_DELAY_MS,
  };
}

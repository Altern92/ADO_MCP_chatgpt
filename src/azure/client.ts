import { AzureDevOpsApiError, AzureDevOpsNetworkError, AzureDevOpsTimeoutError } from "../errors.js";
import { type Logger, createCorrelationId } from "../logging.js";

export interface AzureDevOpsClientLike {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  getText?(path: string): Promise<string>;
}

type FetchLike = typeof fetch;

interface AzureDevOpsClientConfig {
  readonly azdoOrg: string;
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
}

export function createBasicAuthHeader(pat: string): string {
  const token = Buffer.from(`:${pat}`).toString("base64");
  return `Basic ${token}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getBodyExcerpt(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, 300);
}

export class AzureDevOpsClient implements AzureDevOpsClientLike {
  constructor(
    private readonly config: AzureDevOpsClientConfig,
    private readonly pat: string,
    private readonly logger: Logger,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path, undefined, "json");
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body, "json");
  }

  async getText(path: string): Promise<string> {
    return this.request<string>("GET", path, undefined, "text");
  }

  private buildUrl(path: string): string {
    return new URL(path, `${this.config.azdoOrg}/`).toString();
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    responseType: "json" | "text" = "json",
  ): Promise<T> {
    const url = this.buildUrl(path);
    let attempt = 0;

    while (true) {
      const correlationId = createCorrelationId();

      this.logger.debug("Azure DevOps request started", {
        method,
        path,
        correlationId,
        attempt,
      });

      try {
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: createBasicAuthHeader(this.pat),
            Accept:
              responseType === "text"
                ? "text/plain, application/json"
                : "application/json",
            "Content-Type": "application/json",
            "X-Correlation-Id": correlationId,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        const responseText = await response.text();

        if (!response.ok) {
          this.logger.warn("Azure DevOps request returned error status", {
            method,
            path,
            correlationId,
            attempt,
            status: response.status,
          });

          if (attempt < this.config.maxRetries && isRetryableStatus(response.status)) {
            attempt += 1;
            await sleep(this.config.retryBaseDelayMs * attempt);
            continue;
          }

          throw new AzureDevOpsApiError(
            path,
            response.status,
            correlationId,
            getBodyExcerpt(responseText),
          );
        }

        this.logger.debug("Azure DevOps request succeeded", {
          method,
          path,
          correlationId,
          attempt,
          status: response.status,
        });

        if (!responseText.trim()) {
          return (responseType === "text" ? "" : {}) as T;
        }

        if (responseType === "text") {
          return responseText as T;
        }

        return JSON.parse(responseText) as T;
      } catch (error) {
        if (error instanceof AzureDevOpsApiError) {
          throw error;
        }

        if (error instanceof Error && error.name === "TimeoutError") {
          if (attempt < this.config.maxRetries) {
            attempt += 1;
            await sleep(this.config.retryBaseDelayMs * attempt);
            continue;
          }

          throw new AzureDevOpsTimeoutError(path, correlationId);
        }

        if (attempt < this.config.maxRetries) {
          attempt += 1;
          await sleep(this.config.retryBaseDelayMs * attempt);
          continue;
        }

        const reason = error instanceof Error ? error.message : String(error);
        throw new AzureDevOpsNetworkError(path, correlationId, reason);
      }
    }
  }
}

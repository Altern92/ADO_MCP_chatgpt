export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly statusCode?: number,
    public readonly correlationId?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, "configuration_error", message);
  }
}

export class ProjectAccessError extends AppError {
  constructor(project: string) {
    super(
      `Project "${project}" is not permitted by AZDO_PROJECT_ALLOWLIST.`,
      "project_access_denied",
      `Project "${project}" is not permitted by this connector.`,
      403,
    );
  }
}

export class AzureDevOpsApiError extends AppError {
  constructor(
    public readonly path: string,
    public readonly azureStatus: number,
    correlationId: string,
    bodyExcerpt?: string,
  ) {
    super(
      `Azure DevOps request failed with status ${azureStatus} for path ${path}.`,
      "azure_devops_api_error",
      formatAzureUserMessage(azureStatus, correlationId),
      azureStatus,
      correlationId,
      bodyExcerpt ? { bodyExcerpt } : undefined,
    );
  }
}

export class AzureDevOpsTimeoutError extends AppError {
  constructor(path: string, correlationId: string) {
    super(
      `Azure DevOps request timed out for path ${path}.`,
      "azure_devops_timeout",
      `Azure DevOps request timed out. Try again. (ref ${correlationId})`,
      504,
      correlationId,
    );
  }
}

export class AzureDevOpsNetworkError extends AppError {
  constructor(path: string, correlationId: string, reason: string) {
    super(
      `Azure DevOps network request failed for path ${path}: ${reason}`,
      "azure_devops_network_error",
      `Azure DevOps network request failed before a response was received. (ref ${correlationId})`,
      502,
      correlationId,
      { reason },
    );
  }
}

function formatAzureUserMessage(status: number, correlationId: string): string {
  switch (status) {
    case 401:
      return `Azure DevOps authentication failed. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access. (ref ${correlationId})`;
    case 403:
      return `Azure DevOps denied access to this resource. (ref ${correlationId})`;
    case 404:
      return `Azure DevOps resource was not found. Check organization, project, repository, or item identifiers. (ref ${correlationId})`;
    case 429:
      return `Azure DevOps rate limit was reached. Try again soon. (ref ${correlationId})`;
    default:
      if (status >= 500) {
        return `Azure DevOps returned a server error. Try again later. (ref ${correlationId})`;
      }

      return `Azure DevOps request failed. (ref ${correlationId})`;
  }
}

export function getUserFacingError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      "unexpected_error",
      "Unexpected server error.",
    );
  }

  return new AppError(
    "Unexpected non-error value thrown.",
    "unexpected_error",
    "Unexpected server error.",
  );
}

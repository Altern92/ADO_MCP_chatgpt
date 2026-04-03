import { getUserFacingError } from "../errors.js";
import type { Logger } from "../logging.js";

export function createStructuredToolResult<T>(
  text: string,
  structuredContent: T,
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
} {
  return {
    content: [{ type: "text", text }],
    structuredContent,
  };
}

export function createToolErrorResult(
  error: unknown,
  logger: Logger,
  toolName: string,
): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const appError = getUserFacingError(error);

  logger.error("MCP tool failed", {
    toolName,
    code: appError.code,
    correlationId: appError.correlationId,
    statusCode: appError.statusCode,
    details: appError.details,
    message: appError.message,
  });

  return {
    content: [{ type: "text", text: appError.userMessage }],
    isError: true,
  };
}

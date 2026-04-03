import type { Server as HttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import type { AppConfig } from "../config.js";
import { AzureDevOpsClient } from "../azure/client.js";
import { createAzureDevOpsServices } from "../domain/index.js";
import { createBearerAuthMiddleware } from "./auth.js";
import { createHostValidationMiddleware } from "./hostValidation.js";
import { Logger } from "../logging.js";
import { buildMcpServer } from "../mcp/server.js";

interface CreateAppDependencies {
  readonly logger?: Logger;
  readonly fetchImpl?: typeof fetch;
}

function getBaseUrl(req: Request): string {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function protectedResourceMetadata(req: Request, config: AppConfig) {
  const baseUrl = getBaseUrl(req);

  return {
    resource: baseUrl,
    authorization_servers: [],
    scopes_supported: [],
    bearer_methods_supported: ["header"],
    resource_name: config.appName,
    resource_documentation: `${baseUrl}/health`,
    authorization_required: true,
    authentication_methods_supported: ["bearer"],
  };
}

function noAuthAuthorizationServerMetadata(req: Request) {
  const baseUrl = getBaseUrl(req);

  return {
    issuer: baseUrl,
    authorization_required: false,
    grant_types_supported: [],
    response_types_supported: [],
    scopes_supported: [],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: [],
    service_documentation: `${baseUrl}/health`,
  };
}

function noAuthOpenIdConfiguration(req: Request) {
  const baseUrl = getBaseUrl(req);

  return {
    issuer: baseUrl,
    authorization_required: false,
    grant_types_supported: [],
    response_types_supported: [],
    scopes_supported: [],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["none"],
    token_endpoint_auth_methods_supported: ["none"],
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    service_documentation: `${baseUrl}/health`,
  };
}

function methodNotAllowed() {
  return {
    jsonrpc: "2.0" as const,
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  };
}

function isSupportedMcpMethod(method: string): method is "GET" | "POST" | "DELETE" {
  return method === "GET" || method === "POST" || method === "DELETE";
}

async function handleMcpRequest(
  req: Request,
  res: Response,
  config: AppConfig,
  logger: Logger,
  fetchImpl?: typeof fetch,
) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const adoPat = req.adoPat ?? "";
  const client = new AzureDevOpsClient(config, adoPat, logger, fetchImpl);
  const services = createAzureDevOpsServices(client, config);
  const server = buildMcpServer(services, logger);

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error("MCP HTTP request failed", {
      route: "/mcp",
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
}

export function createApp(config: AppConfig, deps: CreateAppDependencies = {}) {
  const logger = deps.logger ?? new Logger(config.logLevel);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(createHostValidationMiddleware(config.allowedHosts));

  app.get(
    "/.well-known/oauth-protected-resource",
    (req: Request, res: Response) => {
      res.json(protectedResourceMetadata(req, config));
    },
  );

  app.get(
    "/.well-known/oauth-authorization-server",
    (req: Request, res: Response) => {
      res.json(noAuthAuthorizationServerMetadata(req));
    },
  );

  app.get(
    "/.well-known/openid-configuration",
    (req: Request, res: Response) => {
      res.json(noAuthOpenIdConfiguration(req));
    },
  );

  app.get("/.well-known/jwks.json", (_req: Request, res: Response) => {
    res.json({ keys: [] });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      server: config.appName,
      version: config.appVersion,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.options("/mcp", (_req: Request, res: Response) => {
    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    res.status(204).end();
  });

  app.use("/mcp", createBearerAuthMiddleware());

  app.all("/mcp", async (req: Request, res: Response) => {
    if (!isSupportedMcpMethod(req.method)) {
      res.status(405).json(methodNotAllowed());
      return;
    }

    await handleMcpRequest(req, res, config, logger, deps.fetchImpl);
  });

  return app;
}

export async function closeServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

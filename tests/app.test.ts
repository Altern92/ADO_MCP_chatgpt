import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { closeServer, createApp } from "../src/http/app.js";

const servers: Array<ReturnType<ReturnType<typeof createApp>["listen"]>> = [];

const TEST_ENV = {
  AZDO_ORG: "https://dev.azure.com/example",
  PORT: "3000",
} as const;

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await closeServer(server);
    }
  }
});

interface TestResponse {
  readonly statusCode: number;
  readonly body: string;
}

async function requestServer(
  port: number,
  path: string,
  options: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  } = {},
): Promise<TestResponse> {
  return await new Promise<TestResponse>((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body,
          });
        });
      },
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

describe("HTTP app", () => {
  it("serves a public health endpoint", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("allows ngrok hostnames on the health endpoint", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await requestServer(address.port, "/health", {
      headers: {
        Host: "demo.ngrok-free.dev",
      },
    });
    const body = JSON.parse(response.body) as { status: string };

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("serves no-auth OAuth discovery metadata", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await requestServer(
      address.port,
      "/.well-known/oauth-authorization-server",
      {
        headers: {
          Host: "demo.ngrok-free.dev",
          "X-Forwarded-Proto": "https",
        },
      },
    );
    const body = JSON.parse(response.body) as {
      issuer: string;
      authorization_required: boolean;
      token_endpoint_auth_methods_supported: string[];
    };

    expect(response.statusCode).toBe(200);
    expect(body.issuer).toBe(
      "https://demo.ngrok-free.dev",
    );
    expect(body.authorization_required).toBe(false);
    expect(body.token_endpoint_auth_methods_supported).toEqual(["none"]);
  });

  it("serves bearer-protected resource metadata", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await requestServer(
      address.port,
      "/.well-known/oauth-protected-resource",
      {
        headers: {
          Host: "demo.ngrok-free.dev",
          "X-Forwarded-Proto": "https",
        },
      },
    );
    const body = JSON.parse(response.body) as {
      resource: string;
      authorization_servers: string[];
      authorization_required: boolean;
      bearer_methods_supported: string[];
      authentication_methods_supported: string[];
    };

    expect(response.statusCode).toBe(200);
    expect(body.resource).toBe(
      "https://demo.ngrok-free.dev",
    );
    expect(body.authorization_servers).toEqual([]);
    expect(body.authorization_required).toBe(true);
    expect(body.bearer_methods_supported).toEqual(["header"]);
    expect(body.authentication_methods_supported).toEqual(["bearer"]);
  });

  it("rejects untrusted hostnames", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await requestServer(address.port, "/health", {
      headers: {
        Host: "evil.example.com",
      },
    });
    const body = JSON.parse(response.body) as {
      error: {
        message: string;
      };
    };

    expect(response.statusCode).toBe(403);
    expect(body.error.message).toBe("Invalid Host: evil.example.com");
  });

  it("rejects /mcp requests without a bearer token", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await requestServer(address.port, "/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });
    const body = JSON.parse(response.body) as {
      error: {
        message: string;
      };
    };

    expect(response.statusCode).toBe(401);
    expect(body.error.message).toBe("Unauthorized");
  });

  it("accepts any bearer token for /mcp authentication and leaves routing to MCP", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await requestServer(address.port, "/mcp", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer user-specific-ado-pat",
      },
    });

    expect(response.statusCode).toBe(406);
  });

  it("passes DELETE /mcp through to the MCP transport", async () => {
    const config = loadConfig(TEST_ENV);

    const app = createApp(config);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await new Promise<void>((resolve) => server.once("listening", () => resolve()));

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer user-specific-ado-pat",
      },
    });

    expect(response.status).toBe(200);
  });
});

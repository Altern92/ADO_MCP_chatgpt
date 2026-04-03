import { describe, expect, it } from "vitest";
import { Logger } from "../src/logging.js";
import { buildMcpServer } from "../src/mcp/server.js";
import type { AzureDevOpsServices } from "../src/domain/index.js";

describe("MCP server tool registration", () => {
  it("registers the new composite tools", () => {
    const services = new Proxy(
      {},
      {
        get: () => async () => undefined,
      },
    ) as AzureDevOpsServices;

    const server = buildMcpServer(services, new Logger("info"));
    const toolNames = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
    );

    expect(toolNames).toEqual(
      expect.arrayContaining([
        "get_sprint_capacity",
        "get_cross_project_dependencies",
        "get_dashboard_widget_data",
        "analyze_test_failure_impact",
      ]),
    );
  });
});

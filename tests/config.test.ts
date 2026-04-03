import { describe, expect, it } from "vitest";
import {
  assertProjectAllowed,
  loadConfig,
  parseAllowedHosts,
  parseAllowlist,
} from "../src/config.js";

describe("config", () => {
  it("loads required environment values", () => {
    const config = loadConfig({
      AZDO_ORG: "https://dev.azure.com/example",
      AZDO_PROJECT_ALLOWLIST: "Project One, Project Two",
      PORT: "3100",
      LOG_LEVEL: "debug",
      ALLOWED_HOSTS: "mcp.example.com, *.internal.example",
    });

    expect(config.azdoOrg).toBe("https://dev.azure.com/example");
    expect(config.port).toBe(3100);
    expect(config.logLevel).toBe("debug");
    expect(config.azdoProjectAllowlist).toEqual(["Project One", "Project Two"]);
    expect(config.allowedHosts).toEqual([
      "localhost",
      "127.0.0.1",
      "[::1]",
      "*.ngrok-free.dev",
      "*.ngrok-free.app",
      "*.ngrok.io",
      "mcp.example.com",
      "*.internal.example",
    ]);
  });

  it("accepts a bare Azure DevOps organization name", () => {
    const config = loadConfig({
      AZDO_ORG: "example-org",
    });

    expect(config.azdoOrg).toBe("https://dev.azure.com/example-org");
  });

  it("parses empty allowlist safely", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
  });

  it("parses allowed hosts with defaults and de-duplicates entries", () => {
    expect(parseAllowedHosts("localhost, demo.ngrok-free.dev, *.ngrok-free.dev")).toEqual([
      "localhost",
      "127.0.0.1",
      "[::1]",
      "*.ngrok-free.dev",
      "*.ngrok-free.app",
      "*.ngrok.io",
      "demo.ngrok-free.dev",
    ]);
  });

  it("blocks disallowed projects", () => {
    expect(() =>
      assertProjectAllowed("Blocked Project", {
        azdoProjectAllowlist: ["Allowed Project"],
      }),
    ).toThrow(/Blocked Project/);
  });
});

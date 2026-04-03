import { describe, expect, it, vi } from "vitest";
import { AzureDevOpsClient, createBasicAuthHeader } from "../src/azure/client.js";
import { AzureDevOpsApiError } from "../src/errors.js";
import { Logger } from "../src/logging.js";

describe("AzureDevOpsClient", () => {
  it("creates the expected basic auth header", () => {
    const header = createBasicAuthHeader("pat-value");
    const decoded = Buffer.from(header.replace("Basic ", ""), "base64").toString("utf8");

    expect(header.startsWith("Basic ")).toBe(true);
    expect(decoded).toBe(":pat-value");
  });

  it("retries transient failures and then succeeds", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "try again" }), { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [{ id: "1", name: "Project One" }] }), {
          status: 200,
        }),
      );

    const client = new AzureDevOpsClient(
      {
        azdoOrg: "https://dev.azure.com/example",
        requestTimeoutMs: 100,
        maxRetries: 1,
        retryBaseDelayMs: 1,
      },
      "secret",
      new Logger("error"),
      fetchMock,
    );

    const result = await client.get<{ value: Array<{ id: string; name: string }> }>(
      "/_apis/projects?api-version=7.1",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.value[0]?.name).toBe("Project One");
  });

  it("maps invalid PAT failures to a safe upstream error", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const client = new AzureDevOpsClient(
      {
        azdoOrg: "https://dev.azure.com/example",
        requestTimeoutMs: 100,
        maxRetries: 0,
        retryBaseDelayMs: 1,
      },
      "secret",
      new Logger("error"),
      fetchMock,
    );

    await expect(client.get("/_apis/projects?api-version=7.1")).rejects.toBeInstanceOf(
      AzureDevOpsApiError,
    );
  });

  it("supports plain text responses for build logs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("line 1\nline 2", { status: 200 }),
    );

    const client = new AzureDevOpsClient(
      {
        azdoOrg: "https://dev.azure.com/example",
        requestTimeoutMs: 100,
        maxRetries: 0,
        retryBaseDelayMs: 1,
      },
      "secret",
      new Logger("error"),
      fetchMock,
    );

    const result = await client.getText("/_apis/build/builds/1/logs/2?api-version=7.1");

    expect(result).toBe("line 1\nline 2");
  });
});

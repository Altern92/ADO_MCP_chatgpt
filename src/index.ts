import "dotenv/config";
import { loadConfig } from "./config.js";
import { createApp, closeServer } from "./http/app.js";
import { Logger } from "./logging.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const app = createApp(config, { logger });

  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info("Azure DevOps MCP server started", {
      host: "0.0.0.0",
      port: config.port,
      mcpEndpoint: `http://0.0.0.0:${config.port}/mcp`,
      healthEndpoint: `http://0.0.0.0:${config.port}/health`,
    });
  });

  const shutdown = async (signal: string) => {
    logger.info("Shutting down server", { signal });
    await closeServer(server);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

# Azure DevOps MCP Server

Read-only Azure DevOps MCP server for ChatGPT and other MCP clients.

## What It Does

This project exposes Azure DevOps data over MCP with tools for:

- projects and repositories
- pull requests and linked work items
- work item lookup and WIQL-backed search
- test plans, suites, cases, and runs
- pipelines, builds, and artifacts
- wiki page content
- several higher-level summary and analysis tools

## Authentication Model

This server does not use a fixed server-side Azure DevOps PAT.

Each user sends their own Azure DevOps PAT in the HTTP header:

```text
Authorization: Bearer <your-azure-devops-pat>
```

The server takes that Bearer token from the request and uses it directly for Azure DevOps API calls.

## Requirements

- Node.js 20+ recommended
- an Azure DevOps organization
- an Azure DevOps PAT for each user

Recommended PAT scopes:

- `Work Items: Read`
- `Code: Read`
- `Build: Read`
- `Test Management: Read`
- `Project and Team: Read`
- `Wiki: Read` if wiki tools are needed

## Configuration

Copy `.env.example` to `.env`.

Required:

- `AZDO_ORG`

Optional:

- `AZDO_PROJECT_ALLOWLIST`
- `PORT`
- `LOG_LEVEL`
- `ALLOWED_HOSTS`

Important:

- If `AZDO_PROJECT_ALLOWLIST` is empty or not set, all projects are accessible.
- If `AZDO_PROJECT_ALLOWLIST` has values, only those projects are accessible.

## Local Development

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build and start:

```bash
npm run build
npm start
```

## Endpoints

Health:

```text
GET /health
```

MCP:

```text
GET /mcp
POST /mcp
DELETE /mcp
```

`/mcp` requires an `Authorization: Bearer <Azure-DevOps-PAT>` header.

## Deployment

This repo includes:

- Linux host deployment scripts in [deploy/README.md](./deploy/README.md)
- Docker deployment files in [deploy/docker-README.md](./deploy/docker-README.md)

## Notes

- This server is strictly read-only.
- `.env`, logs, and certificate PEM files are git-ignored.
- See [USAGE.md](./USAGE.md) for a more detailed usage guide.

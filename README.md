# Azure DevOps MCP Server

Read-only Azure DevOps MCP server for ChatGPT and other MCP clients. It exposes Azure DevOps projects, work items, tests, traceability, pull requests, commits, discovery catalogs, reporting exports, and similarity analytics through a single MCP endpoint.

## Read-only guarantee

- The server only performs Azure DevOps `GET` and read-only query execution paths.
- It does not create, edit, transition, comment on, or delete Azure DevOps entities.
- User access is still limited by the caller's Azure DevOps PAT and the optional project allowlist.

## Tool groups

- Core inventory: projects, repositories, pull requests, pipelines, wiki, dashboard, sprint, and digest tools
- Work items: summary search, advanced WIQL-backed search, full retrieval, comments, updates, revisions, categories, and types
- Test management: plans, suites, points, cases, runs, and full plan exports
- Traceability: work item graphs, linked items, test links, coverage, and requirement traceability
- Code intelligence: PR search, PR full view, PR commits, PR diff, commit full view, and commit search by work item
- Discovery and reporting: fields, areas, iterations, tags, identity resolution, saved queries, delta export, and traceability dataset export
- Similarity analytics: similar items, duplicate candidates, and similarity clustering

See [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md) for the full catalog.

## Implemented phases

- Phase 1A: foundation analytics core for work items and test-management retrieval
- Phase 1B: detailed retrieval and audit for work item history and enriched test cases
- Phase 2: traceability and code intelligence across work items, tests, PRs, and commits
- Phase 3: discovery, reporting, exports, and similarity analytics

## Authentication

This server does not use a fixed server-side Azure DevOps PAT. Each caller provides their own Azure DevOps PAT in the HTTP header:

```text
Authorization: Bearer <your-azure-devops-pat>
```

The server forwards that bearer token to Azure DevOps for read-only API calls.

## Requirements

- Node.js 18+ required, Node.js 20+ recommended
- npm
- Azure DevOps organization access
- Azure DevOps PAT per user

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

Notes:

- `AZDO_ORG` accepts either a full URL such as `https://dev.azure.com/your-org` or a short org name such as `your-org`.
- If `AZDO_PROJECT_ALLOWLIST` is empty, the server allows all projects reachable by the caller PAT.
- If `AZDO_PROJECT_ALLOWLIST` is set, only those projects are exposed.
- `ALLOWED_HOSTS` is an inbound host allowlist for the HTTP app.

## Local run

Install dependencies:

```bash
npm install
```

Start in development:

```bash
npm run dev
```

Build and start:

```bash
npm run build
npm start
```

Endpoints:

- `GET /health`
- `GET /mcp`
- `POST /mcp`
- `DELETE /mcp`

`/mcp` requires `Authorization: Bearer <Azure-DevOps-PAT>`.

## Quality checks

- `npm test`
- `npm run build`

There is currently no `npm run lint` script in this repo.

## Usage docs

- [USAGE.md](./USAGE.md): practical usage patterns and example workflows
- [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md): grouped tool catalog, key inputs, outputs, and smoke test checklist
- [Implementation_Phases.md](./Implementation_Phases.md): execution history and release-readiness checklist

## Known limitations

- Real Azure DevOps behavior depends on the caller PAT scopes and entity-level permissions.
- Some Azure DevOps endpoints do not always return the same optional payloads across orgs or API previews, especially `wiql`, diff patch bodies, comments, and some test metadata.
- `includeRaw` can substantially increase payload size.
- Export tools are caller-controlled and batch internally, but very large datasets are still best handled in smaller project- or query-scoped slices.
- Similarity and duplicate detection are deterministic heuristics, not ML embeddings; they are explainable by design and optimized for transparency.
- Cross-project traversal only includes projects allowed by `AZDO_PROJECT_ALLOWLIST`.

## Release readiness

The current repo state includes:

- all planned Phase 1, Phase 2, and Phase 3 MCP tools
- MCP registration, service wiring, and test coverage for the implemented tool families
- updated delivery docs for local run, catalog browsing, and smoke testing

For a real-world smoke test, use the checklist in [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md#smoke-test-checklist) with a valid PAT and an Azure DevOps project you can safely inspect.

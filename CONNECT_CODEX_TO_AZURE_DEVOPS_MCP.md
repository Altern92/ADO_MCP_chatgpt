# How to Connect Codex to the Azure DevOps MCP Server

This guide explains how to connect `Codex` to the local Azure DevOps MCP server from this repository.

The goal is that a new teammate can follow these steps once and have Codex working without trial and error.

## What This Server Does

This MCP server exposes read-only Azure DevOps data to MCP clients such as `Codex`.

Important authentication detail:

- the server does not use a shared server-side Azure DevOps PAT
- each user must use their own Azure DevOps PAT
- the PAT is sent as `Authorization: Bearer <your-pat>`

## Prerequisites

Before you start, make sure you have:

- `Node.js` installed
- `npm` installed
- access to the Azure DevOps organization
- your own Azure DevOps `PAT`
- `Codex CLI` installed and working

Recommended Azure DevOps PAT scopes:

- `Work Items: Read`
- `Code: Read`
- `Build: Read`
- `Test Management: Read`
- `Project and Team: Read`
- `Wiki: Read` if you need wiki tools

## Step 1: Open the Repository

Open PowerShell in the repository root.

Example:

```powershell
cd "C:\Path\To\ADO MCP"
```

## Step 2: Create the Local Environment File

Copy the example file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set at least the Azure DevOps organization:

```env
AZDO_ORG=cmd-sw
PORT=3000
LOG_LEVEL=info
```

Optional settings:

- `AZDO_PROJECT_ALLOWLIST` to limit which projects are accessible
- `ALLOWED_HOSTS` if you expose the server through a domain or reverse proxy

Notes:

- `AZDO_ORG` is required
- do not store your PAT in `.env`
- this server expects the PAT to come from the client request header

## Step 3: Install Dependencies

Run:

```powershell
npm install
```

## Step 4: Start the MCP Server

Recommended option:

```powershell
.\start-mcp.ps1
```

Alternative:

```powershell
npm run dev
```

If the server starts correctly, it should be available on:

```text
http://localhost:3000
```

## Step 5: Confirm the Server Is Healthy

Run:

```powershell
Invoke-WebRequest http://localhost:3000/health
```

Expected result:

- HTTP status `200`

If this fails, do not continue yet. Fix the server startup first.

## Step 6: Create an Azure DevOps PAT

In Azure DevOps:

1. Open your Azure DevOps organization.
2. Click your profile picture.
3. Open `Personal access tokens`.
4. Create a new token.
5. Give it a clear name, for example `Codex MCP`.
6. Set an expiry period that matches your team policy.
7. Add the required read scopes listed above.
8. Create the token and copy it immediately.

Important:

- each user must use their own PAT
- never share a PAT with teammates
- if the PAT expires, Codex will stop working until it is replaced

## Step 7: Put the PAT Into an Environment Variable

In the same PowerShell window, set:

```powershell
$env:AZDO_PAT="paste-your-azure-devops-pat-here"
```

This is the simplest and safest first-time setup because Codex can read the token from an environment variable.

Optional persistent setup:

```powershell
setx AZDO_PAT "paste-your-azure-devops-pat-here"
```

If you use `setx`, close and reopen PowerShell afterward so the new variable is available.

## Step 8: Register the MCP Server in Codex

Run:

```powershell
codex mcp add azure-devops --url http://localhost:3000/mcp --bearer-token-env-var AZDO_PAT
```

What this does:

- registers the MCP server under the name `azure-devops`
- points Codex to the local MCP endpoint
- tells Codex to send the bearer token using the `AZDO_PAT` environment variable

## Step 9: Verify the Codex MCP Configuration

Check that Codex sees the server:

```powershell
codex mcp list
```

Inspect the saved configuration:

```powershell
codex mcp get azure-devops --json
```

You should see the MCP server entry with:

- the URL `http://localhost:3000/mcp`
- the bearer token environment variable `AZDO_PAT`

## Step 10: Restart Codex

If Codex was already open before you set `AZDO_PAT`, restart Codex or open a new Codex session.

This matters because Codex may not see environment variables that were added after it started.

## Step 11: Test It in Codex

Try a simple prompt such as:

```text
List my Azure DevOps projects.
```

If the MCP connection is working, Codex should be able to call the Azure DevOps MCP tools.

## One-Command Summary

After `.env` is ready, the shortest working setup is:

```powershell
npm install
.\start-mcp.ps1
$env:AZDO_PAT="paste-your-pat-here"
codex mcp add azure-devops --url http://localhost:3000/mcp --bearer-token-env-var AZDO_PAT
codex mcp list
```

## Common Problems

### Problem: `401 Unauthorized`

Typical causes:

- `AZDO_PAT` is not set
- the PAT is wrong or expired
- the PAT does not have the required scopes
- Codex was started before the environment variable existed

Fix:

- set `AZDO_PAT` again
- restart Codex
- verify the PAT scopes

### Problem: `403 Forbidden`

Typical causes:

- the PAT is valid but does not have enough permissions
- the project is blocked by `AZDO_PROJECT_ALLOWLIST`

Fix:

- check the PAT scopes
- check the `.env` allowlist configuration

### Problem: `404 Not Found`

Typical causes:

- wrong URL
- using `/` instead of `/mcp`
- the server is not running on the expected port

Fix:

- verify `http://localhost:3000/mcp`
- verify `PORT` in `.env`
- test `/health` first

### Problem: Codex cannot reach `localhost`

Typical cause:

- Codex and the MCP server are not running on the same machine

Fix:

- if Codex runs elsewhere, use a reachable host or domain instead of `localhost`

Example:

```powershell
codex mcp add azure-devops --url https://your-domain.example.com/mcp --bearer-token-env-var AZDO_PAT
```

If you expose the server through a proxy, make sure the proxy forwards the `Authorization` header.

## Security Notes

- this server is read-only
- use the minimum PAT scopes needed
- never commit `.env` with secrets
- never share PATs in chat, email, or screenshots
- if using a public or shared deployment, configure `ALLOWED_HOSTS` and any network restrictions carefully

## Team Recommendation

For the smoothest first-time setup on Windows:

1. keep the MCP server local
2. use `.\start-mcp.ps1`
3. use a per-user PAT in `AZDO_PAT`
4. register the server in Codex with `--bearer-token-env-var AZDO_PAT`

That setup is the simplest to support and the easiest to troubleshoot.

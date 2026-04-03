# Docker Deployment

## Prerequisites
- Docker and Docker Compose installed on the server
- Domain pointing to server IP
- SSL certificate files (`cert.pem` and `key.pem`)

## First time setup

1. Clone repo:
   `git clone <repo-url> /opt/mcp-server`
   `cd /opt/mcp-server`

2. Create .env:
   `cp .env.example .env`
   `nano .env`
   Set `AZDO_ORG` and `ALLOWED_HOSTS` to your domain.

3. Add SSL certificates:
   Copy `cert.pem` and `key.pem` to `nginx/certs/`
   or use the self-signed cert generation command below.

4. Start:
   `docker compose up -d`

5. Check health:
   `curl https://yourdomain.com/health`

## Generate self-signed certificate (testing only)
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem \
  -out nginx/certs/cert.pem \
  -subj "/CN=yourdomain.com"
```

## Update after code changes
`git pull`
`docker compose build mcp`
`docker compose up -d`

## View logs
`docker compose logs -f mcp`
`docker compose logs -f nginx`

## Stop
`docker compose down`

## ChatGPT configuration (per user)
`URL: https://yourdomain.com/mcp`
`Header name: Authorization`
`Header value: Bearer <your-azure-devops-pat>`

## How to get Azure DevOps PAT
1. Go to `https://dev.azure.com/YOUR-ORG`
2. Profile picture -> Personal access tokens
3. New Token
4. Name: `ChatGPT MCP`
   Expiration: `90 days`
   Scopes:
   `Work Items: Read`
   `Code: Read`
   `Build: Read`
   `Test Management: Read`
   `Project and Team: Read`
5. Copy token
6. Paste as Bearer value in ChatGPT

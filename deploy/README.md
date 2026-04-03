# Deployment

## First time setup

1. Clone repo on Linux server:
   `git clone <repo-url> /tmp/mcp-server-deploy`
   `cd /tmp/mcp-server-deploy`

2. Run setup:
   `chmod +x deploy/setup.sh`
   `sudo ./deploy/setup.sh`

3. Edit config:
   `sudo nano /opt/mcp-server/.env`
   Set `AZDO_ORG` and update `ALLOWED_HOSTS` if needed.

4. Restart:
   `pm2 restart mcp-server`

5. Add SSL (replace with your domain):
   `chmod +x deploy/setup-ssl.sh`
   `sudo ./deploy/setup-ssl.sh yourdomain.com`

6. Test:
   `curl https://yourdomain.com/health`

## Update after code changes

`chmod +x deploy/update.sh`
`sudo ./deploy/update.sh`

## ChatGPT configuration (per user)

`URL: https://yourdomain.com/mcp`
`Header name: Authorization`
`Header value: Bearer <your-azure-devops-pat>`

## How to get Azure DevOps PAT

1. Go to `https://dev.azure.com/YOUR-ORG`
2. Click your profile picture -> Personal access tokens
3. New Token
4. Name: `ChatGPT MCP`
5. Expiration: `90 days`
6. Scopes:
   `Work Items: Read`
   `Code: Read`
   `Build: Read`
   `Test Management: Read`
   `Project and Team: Read`
7. Create -> Copy token
8. Paste as Bearer value in ChatGPT

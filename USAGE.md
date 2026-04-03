# Azure DevOps MCP Serverio Naudojimo Gidas

## Paskirtis

Sis serveris suteikia ChatGPT ir kitiems MCP klientams read-only prieiga prie Azure DevOps.

Svarbiausia autentikacijos taisykle:

- kiekvienas naudotojas siuncia savo Azure DevOps PAT
- PAT perduodamas per `Authorization: Bearer <PAT>`
- serveris naudoja ta PAT tiesiogiai Azure DevOps uzklausoms

Serveris nenaudoja bendro serverio rakto ir nenaudoja fiksuoto Azure DevOps PAT is `.env`.

## Reikalavimai

- `Node.js` 20+ rekomenduojama
- `npm`
- Azure DevOps organizacija
- Azure DevOps PAT kiekvienam naudotojui

Rekomenduojami PAT scope'ai:

- `Work Items: Read`
- `Code: Read`
- `Build: Read`
- `Test Management: Read`
- `Project and Team: Read`
- `Wiki: Read`, jei naudosite wiki tool'us

## 1. Paruosk Aplinkos Kintamuosius

Projekto saknyje nukopijuok `.env.example` i `.env`.

Pavyzdinis `.env`:

```env
AZDO_ORG=your-azure-devops-org-name

# Jei tuscia arba nenustatyta - leidziami visi projektai
# AZDO_PROJECT_ALLOWLIST=Project One,Project Two

PORT=3000
LOG_LEVEL=info
ALLOWED_HOSTS=yourdomain.com
```

Svarbu:

- `AZDO_ORG` yra vienintelis privalomas kintamasis
- jei `AZDO_PROJECT_ALLOWLIST` tuscias arba uzkomentuotas, pasiekiami visi projektai
- jei `AZDO_PROJECT_ALLOWLIST` turi reiksmes, pasiekiami tik tie projektai
- niekada nekelk `.env` i Git
- niekada nesidalink Azure DevOps PAT

## 2. Instaliuok Priklausomybes

```bash
npm install
```

## 3. Paleisk Serveri

Development rezimu:

```bash
npm run dev
```

Sukompiliuotai versijai:

```bash
npm run build
npm start
```

Pagal nutylejima serveris startuoja:

```text
http://0.0.0.0:3000
```

## 4. Patikrink Health Endpoint

```text
GET /health
```

Pavyzdys:

```bash
curl http://127.0.0.1:3000/health
```

## 5. MCP Prisijungimas

MCP endpointas:

```text
/mcp
```

Naudok:

```text
Authorization: Bearer <your-azure-devops-pat>
```

Svarbu:

- `GET /mcp`, `POST /mcp` ir `DELETE /mcp` apdorojami per MCP transporta
- serveris grazins `401 Unauthorized` tik tada, jei `Authorization` headeris visai nepateiktas

## 6. ChatGPT Konfiguracija

ChatGPT connectoriui naudok:

```text
URL: https://yourdomain.com/mcp
Header name: Authorization
Header value: Bearer <your-azure-devops-pat>
```

## 7. Kaip Gauti Azure DevOps PAT

1. Eik i `https://dev.azure.com/YOUR-ORG`
2. Spausk savo profilio nuotrauka
3. Pasirink `Personal access tokens`
4. Sukurk `New Token`
5. Pavadinimas: `ChatGPT MCP`
6. Galiojimas: pvz. `90 days`
7. Scope'ai:
   `Work Items: Read`
   `Code: Read`
   `Build: Read`
   `Test Management: Read`
   `Project and Team: Read`
8. Sukurk tokena ir nukopijuok ji
9. Naudok ji kaip Bearer reiksme ChatGPT ar kitame MCP kliente

## 8. Tool'u Pavyzdziai

- `list_projects`
- `list_repositories`
- `list_pull_requests`
- `get_pull_request_work_items`
- `get_work_item`
- `search_work_items`
- `list_test_plans`
- `list_test_suites`
- `list_test_cases`
- `list_test_runs`
- `list_pipelines`
- `list_pipeline_runs`
- `list_pipeline_artifacts`
- `get_wiki_page`

Pavyzdiniai promptai:

```text
List my available Azure DevOps projects.
```

```text
Show repositories in project "My Project".
```

```text
Get work item 12345.
```

```text
Show the last 10 pipeline runs in project "My Project".
```

## 9. Dazniausios Problemos

### `Missing required environment variable AZDO_ORG`

Tai reiskia, kad `.env` faile truksta `AZDO_ORG`.

### `401 Unauthorized`

Dazniausios priezastys:

- nepridetas `Authorization` headeris
- Bearer tokene pateiktas neteisingas arba pasibaiges Azure DevOps PAT
- PAT neturi reikiamu `Read` scope'u
- PAT neturi prieigos prie organizacijos ar projekto

### `403 Forbidden`

Dazniausios priezastys:

- PAT autentifikuojasi, bet neturi pakankamu teisiu
- projektas blokuojamas per `AZDO_PROJECT_ALLOWLIST`

### `404 Not Found`

Dazniausios priezastys:

- neteisingas organizacijos pavadinimas ar URL
- neteisingas projekto, repo ar work item identifikatorius

## 10. Saugumo Pastabos

- serveris yra read-only
- naudok tik minimalius butinus PAT scope'us
- nekelk `.env`, logu ar PEM failu i repozitorija
- jei reikia apriboti prieiga, naudok `AZDO_PROJECT_ALLOWLIST`
- jei allowlist nenustatytas, serveris leidzia visus projektus

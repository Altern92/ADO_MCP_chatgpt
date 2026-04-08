# MCP Server Split Proposal

## Tikslas

Pasiulyti, kaip dabartini dideli Azure DevOps MCP serveri isskaidyti i kelis funkcinius MCP serverius taip, kad:

- AI butu lengviau pasirinkti tinkama tool'a
- architektura butu aiskesne
- islaikytume `read-only` modeli
- sumazintume "tool sprawl"
- neisskirstytume per smulkiai ten, kur analitikui beveik visada reikia keliu sričių kartu

## Pagrindine rekomendacija

Nerekomenduoju skaidyti i 3 ar daugiau serveriu is karto.

Siulomas tikslinis modelis:

- `ado-core-test-mcp`
- `ado-analytics-mcp`

Svarbi pastaba:

- `ado-test-mcp` ir `ado-core-mcp` siulyciau sujungti i viena bendra serveri
- tam yra labai daug racijos, nes realus analitikas beveik visada nori:
  - work item
  - test case
  - test run
  - PR / commit
  - traceability
  - pipeline konteksta

Todėl "core" ir "test" atskyrimas butu teoriskai svarus, bet praktiskai per daug smulkus.

## Siuloma galutine struktura

### 1. `ado-core-test-mcp`

Tai butu pagrindinis ADO faktiniu duomenu ir atsekamumo serveris.

Paskirtis:

- faktinis read-only duomenu nuskaitymas
- detalus objektu perziurejimas
- traceability
- testavimo ir kodo pakeitimu atsekamumas

Sis serveris turetu buti pagrindinis daugumai analitiko uzklausu.

#### I ji keliauja esami dabartiniai toolai

Projektai / repo / PR:

- `list_projects`
- `list_repositories`
- `list_pull_requests`
- `get_pull_request_work_items`

Work items:

- `get_work_item`
- `search_work_items`
- `list_work_item_categories`
- `list_work_item_types`
- `search_work_items_advanced`
- `get_work_item_full`
- `export_work_items_full`
- `list_work_item_comments`
- `list_work_item_updates`
- `list_work_item_revisions`

Test management:

- `list_test_plans`
- `list_test_suites`
- `list_test_cases`
- `list_test_runs`
- `get_test_plan`
- `get_test_plan_suites_tree`
- `get_test_suite`
- `list_test_points`
- `get_test_point_history`
- `get_test_run_full`
- `export_test_plan_full`
- `list_test_cases_full`

Pipelines / wiki / summary:

- `list_pipelines`
- `list_pipeline_runs`
- `list_pipeline_artifacts`
- `analyze_pipeline_failure`
- `analyze_test_failure_impact`
- `get_wiki_page`
- `get_my_daily_digest`
- `get_blocked_items`
- `get_sprint_summary`
- `get_sprint_capacity`
- `get_dashboard_widget_data`

#### I ji taip pat turetu eiti visi Phase 2 toolai

Traceability ir code intelligence:

- `get_work_item_relations_graph`
- `list_work_item_link_types`
- `get_traceability_chain`
- `list_linked_work_items`
- `get_pull_request_full`
- `list_pull_request_commits`
- `get_pull_request_diff`
- `get_commit_full`
- `search_pull_requests_by_work_item`
- `search_commits_by_work_item`
- `list_work_item_test_links`
- `get_user_story_test_coverage`
- `get_requirement_traceability_report`
- `get_cross_project_dependencies`

#### I ji turetu eiti ir discovery helperiai

Kad pagrindinis serveris butu savarankiskas ir nereiketu visko traukti per analytics serveri:

- `list_work_item_fields`
- `list_area_paths`
- `list_iteration_paths`
- `list_tags`
- `resolve_identity`

#### Ko nereikia deti i si serveri

- similarity / duplicate detection
- clustering
- sunkus dataset exportai analizei
- reporting orientuoti "derived" toolai

### 2. `ado-analytics-mcp`

Tai butu sunkesnis, "derived analytics" serveris.

Paskirtis:

- analitinis sluoksnis virs faktiniu ADO duomenu
- pattern finding
- duplicate detection
- clustering
- reporting
- dataset export

Sis serveris neturetu dubliuoti bazinio retrieval, kiek tai imanoma.

#### I ji turetu eiti Phase 3 toolai

Similarity / duplicate detection:

- `find_similar_work_items`
- `find_duplicate_candidates`
- `cluster_work_items_by_similarity`

Reporting / export:

- `list_saved_queries`
- `run_saved_query`
- `export_work_items_delta`
- `export_traceability_dataset`

#### Galimas papildomas analytics serverio turinys ateityje

- recurring incident trend analysis
- release readiness reports
- quality drift reports
- flaky test clustering
- root-cause pattern mining
- cross-project defect theme analysis

## Kuria riba naudoti tarp serveriu

Riba turi buti ne pagal Azure DevOps meniu punktus, o pagal klausimo tipa.

### `ado-core-test-mcp` turi atsakyti i klausimus:

- "Parodyk work item / bug / incident / user story"
- "Parodyk test plan / suite / point / run"
- "Parodyk PR, commit, diff"
- "Ka sitas work item susijes su kokiais testais?"
- "Kokie rysiai tarp siu objektu?"
- "Kokie faktiniai duomenys ADO'e egzistuoja?"

### `ado-analytics-mcp` turi atsakyti i klausimus:

- "Surask panasias problemas"
- "Parodyk duplicate kandidatus"
- "Sugrupuok incidentus pagal tematika"
- "Padaryk cross-project analitini reporta"
- "Padaryk delta export analizei"
- "Paruosk dataset tolimesniam AI / BI apdorojimui"

## Kodel toks skaidymas yra geras

### Privalumai

- AI bus lengviau pasirinkti tarp 2 serveriu nei tarp vieno labai isplesto serverio su per daug toolu
- pagrindinis serveris liks aiškiai "factual retrieval + traceability"
- analytics serveris gales augti greiciau ir eksperimentiskiau
- mazesne rizika sugadinti stabilu operational retrieval sluoksni
- aiskesnis ownership modelis

### Kodel nereikia atskiro `ado-test-mcp`

- test duomenys beveik visada naudojami kartu su work item
- test duomenys beveik visada naudojami kartu su bug / incident / user story
- test coverage ir traceability logika naturaliame pasaulyje kertasi su core domain
- atskiras test serveris verstu AI daryti daugiau tarpserveriniu sprendimu nei reikia

Todėl `core + test` viename serveryje yra racionalesnis pasirinkimas.

## Siulomas fizinis isskaidymas repo lygyje

Nesiulyciau iskart visko isardyti i atskirus repo.

Pirmas sveikas variantas:

- vienas repo
- du MCP serverio entrypoint'ai
- bendras shared domain sluoksnis

Pvz. struktura:

```text
src/
  shared/
    azure/
    config/
    logging/
    models/
    mappers/
    auth/
  domain/
    coreTest/
    analytics/
  mcp/
    core-test-server.ts
    analytics-server.ts
  http/
    core-test-app.ts
    analytics-app.ts
```

Arba:

```text
packages/
  ado-shared/
  ado-core-test-mcp/
  ado-analytics-mcp/
```

Jei tikslas yra maziau rizikos, pradeti nuo pirmo varianto.

## Rekomenduojama migracijos seka

### Step 1. Logine separacija be fizinio split

- palikti viena repo
- bendrame kode aiskiai isskirti `core-test` ir `analytics` domenus
- pradeti registruoti toolus per du atskirus server builderius

### Step 2. Atskiri MCP serverio entrypoint'ai

- `buildCoreTestMcpServer(...)`
- `buildAnalyticsMcpServer(...)`

### Step 3. Atskiri deploy target'ai

- atskiri env / port / docker entrypoint'ai
- galimybe deployinti atskirai

### Step 4. Tik tada spręsti, ar reikia atskiro repo

- jei komandos ownership issiskirs
- jei release cadence skirsis
- jei analytics serveris ims augti daug greiciau nei core-test

## Tool pasirinkimo taisykle AI agentui

Kad AI nesipainiotu, taisykle turetu buti tokia:

- jei klausimas apie konkretu objekta, jo faktus, rysius, testus, run'us, PR ar commit'us:
  - naudoti `ado-core-test-mcp`
- jei klausimas apie panasumus, klasterius, ataskaitas, trendus, eksportus ar analitinius dataset'us:
  - naudoti `ado-analytics-mcp`

## Galutine rekomendacija

Siulau ne statyti:

- `ado-core-mcp`
- `ado-test-mcp`
- `ado-analytics-mcp`

O statyti:

- `ado-core-test-mcp`
- `ado-analytics-mcp`

Tai yra geriausias kompromisas tarp:

- per didelio vieno serverio
- ir per smulkaus skaidymo i per daug serveriu

## Praktinis verdictas

Jei tikslas yra, kad sitas chat butu "mission control" ir AI stabiliai suprastu, ka naudoti, tada si struktura yra logiska:

- vienas pagrindinis serveris faktams ir atsekamumui
- vienas atskiras serveris analitikai

Tai butu mano rekomenduojamas target architecture.


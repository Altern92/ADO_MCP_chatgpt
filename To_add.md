# To Add

## Tikslas

Papildyti si Azure DevOps MCP serveri taip, kad jis galetu grazinti ne tik trumpas `Test Plans` ir `Test Suites` suvestines, bet pilnesne informacija apie planus, suite hierarchija ir pasirinktos suite vykdymo duomenis.

Serveris turi likti `read-only`.

## Dabartinis apribojimas

Siandieniniai MCP irankiai:

- `list_test_plans` grazina tik trumpa plano suvestine
- `list_test_suites` grazina tik trumpa suite suvestine
- `list_test_cases` grazina tik `workItemId`, `workItemName` ir minimalius `pointAssignments`
- `list_test_runs` grazina tik bendras run suvestines
- `search_work_items` leidzia tik ribota filtravima pagal `project`, `assignedToMe`, `state`, `text` ir grazina tik trumpa work item suvestine
- `get_work_item` grazina tik nedideli atrinktu lauku rinkini, o ne pilna bug / incident / issue / feature objekta

To nepakanka, jei norime MCP serveryje matyti beveik ta pati vaizda, ka matome Azure DevOps `Test Plans` UI.

## Ko noriu prideti prie MCP irankiu

### 1. Pilnas vieno test plano nuskaitymas

Naujas irankis:

- `get_test_plan`

Paskirtis:

- pagal `project` ir `planId` grazinti pilnesne vieno test plano informacija

Ko noriu atsakyme:

- `id`
- `name`
- `state`
- `startDate`
- `endDate`
- `iteration`
- `areaPath`
- `rootSuiteId` jei Azure DevOps ji duoda
- `owner` / `createdBy` / `updatedBy` jei prieinama
- nuorodos (`url`, `_links`) jei prieinama
- papildomi metaduomenys, kuriuos duoda Azure DevOps API

Papildomas noras:

- jei imanoma, grazinti ir `raw` arba `rawResponse` lauka, kad neprarastume jokios informacijos

### 2. Pilnas test suites medis vienam planui

Naujas irankis:

- `get_test_plan_suites_tree`

Paskirtis:

- pagal `project` ir `planId` grazinti visa suite hierarchija kaip medi, o ne tik plokscia sarasa

Tai turi atitikti kairi Azure DevOps `Test Suites` medi:

- root suite
- child suites
- nested child suites
- galimybe matyti visa plana rekursiskai

Ko noriu kiekvienai suite:

- `id`
- `name`
- `planId`
- `parentSuiteId`
- `suiteType`
- `testCaseCount`
- `requirementId` jei yra
- `queryString` jei tai query-based suite
- `inheritDefaultConfigurations` jei prieinama
- `defaultConfigurations` jei prieinama
- `state` jei prieinama
- `children`
- papildomi metaduomenys, kuriuos duoda API

Svarbu:

- ne tik viena gylio pakopa
- turi buti rekursinis medis
- turi buti patikima tvarka kaip UI
- jei reikia, turi buti apdorotas paging / continuation

### 3. Pilna vienos test suite informacija

Naujas irankis:

- `get_test_suite`

Paskirtis:

- pagal `project`, `planId` ir `suiteId` grazinti pilna vienos suite informacija

Ko noriu atsakyme:

- visi svarbus suite metaduomenys
- parent / children santrauka
- susijusio plano informacija
- suite tipas
- test case skaicius
- konfiguruacijos jei jos susietos
- reikalavimo rysys jei toks yra
- `raw` laukas jei imanoma

### 4. Pilni test points pasirinktai suite

Naujas irankis:

- `list_test_points`

Paskirtis:

- pagal `project`, `planId` ir `suiteId` grazinti pilna `Execute` vaizde matoma `Test Points` lentele

Pagal paveiksliuka noriu matyti bent siuos laukus:

- `pointId`
- `title`
- `outcome`
- `order`
- `testCaseId`
- `testCaseTitle`
- `testSuiteId`
- `testSuiteTitle`
- `configuration`
- `configurationId`
- `tester` / `assignedTo`
- `lastRunId`
- `runBy`
- `timeCompleted`

Jei Azure DevOps API leidzia, papildomai noriu:

- `state`
- `isActive`
- `lastUpdatedDate`
- `lastTestRunId`
- `lastResultId`
- `failureType`
- `resolutionState`
- `workItemProperties`
- `testCase` objekto informacija
- `_links`
- `raw`

Svarbu:

- reikia ne tik sugrupuoti pagal test case
- reikia grazinti atskirus test point irasus
- turi buti imanoma atkurti desineje puseje matoma `Execute` lentele

### 4.1 Test point execution history

Naujas irankis:

- `get_test_point_history`

Paskirtis:

- pagal `project`, `planId`, `suiteId` ir `pointId` grazinti pasirinkto test point vykdymo istorija

Pagal pateikta Azure DevOps langa noriu, kad butu istraukta si informacija:

- `testCase`
- `testSuite`
- `configuration`
- `testRun`
- `outcome`
- `runBy`
- `timeCompleted`

Ko noriu bazineje atsakymo strukturoje:

- `pointId`
- `currentTester`
- `testCaseId`
- `testCaseTitle`
- `testSuiteId`
- `testSuiteTitle`
- `configurationId`
- `configurationName`
- `history`

Ko noriu kiekvienam `history` irasui:

- `outcome`
- `testRunId`
- `runBy`
- `timeCompleted`
- `state` jei prieinama
- `comment` jei prieinama
- `duration` jei prieinama
- `lastUpdatedDate` jei prieinama
- `_links`
- `raw`

Svarbu:

- reikia ne tik paskutinio iraso
- jei Azure DevOps leidzia, noriu pilnos execution history
- turi buti imanoma matyti toki vaizda, kaip parodyta `Test point ID ... execution history` lange

### 4.2 Pilna test run informacija

Naujas irankis:

- `get_test_run_full`

Paskirtis:

- pagal `project` ir `runId` grazinti visa svarbia informacija apie konkretu test run

Minimaliai noriu matyti:

- `runId`
- `name`
- `outcome` / `result`
- `state`
- `runBy`
- `timeCompleted`
- `startedDate`
- `completedDate`
- `testPlan`
- `testSuite`
- `testCase`
- `configuration`

Papildomai noriu visos informacijos apie pati run:

- bendrus run metaduomenis
- susijusius result irasus
- kiek testu paleista, kiek passed, failed, not applicable ir pan.
- kas paleido run
- ar buvo susijes pipeline / build
- komentarus / analysis jei prieinama
- linked work items jei prieinama
- attachments jei prieinama
- `_links`
- `raw`

Pagal Azure DevOps run ekrana noriu, kad jei imanoma butu istraukta ir:

- `priority`
- `analysisOwner`
- `analysisComment`
- `pipelineRunTested`
- `duration`
- step-level rezultatai
- step action tekstai
- expected results
- step attachments

Svarbu:

- sis irankis turi grazinti ne tik run antraste, bet ir visa naudinga run turini
- turi buti tinkamas beveik pilnam vieno run audito / analizes vaizdui
- jei reikia, gali buti papildomu pagalbiniu irankiu run resultams ar attachmentams

### 5. Vieno kvietimo pilnas plano eksportas

Naujas irankis:

- `export_test_plan_full`

Paskirtis:

- vienu kvietimu grazinti visa pasirinkto test plano struktura analizei arba eksportui

Ko noriu rezultato strukturoje:

- `plan`
- `suiteTree`
- `suitesById`
- `pointsBySuiteId`
- `pointHistoryByPointId` jei pasirenkama
- `runsById` jei pasirenkama
- pasirinktinai `testCasesById`

Naudingi optional parametrai:

- `includeSuites`
- `includePoints`
- `includePointHistory`
- `includeRuns`
- `includeTestCases`
- `includeRaw`
- `maxDepth`
- `suiteIds`

Sis irankis butu labai patogus, kai reikia ne po viena kvietima vaikscioti per visa plana, o iskart pasiimti pilna jo vaizda.

### 6. Pilnesni test case duomenys suite kontekste

Naujas irankis:

- `list_test_cases_full`

Paskirtis:

- pagal `project`, `planId`, `suiteId` grazinti ne tik ID ir pavadinima, bet pilnesnius test case duomenis

Ko noriu:

- `workItemId`
- `title`
- `state`
- `priority`
- `assignedTo`
- `automationStatus`
- `areaPath`
- `iterationPath`
- `steps` jei imanoma istraukti
- `parameters` jei yra
- `sharedSteps` jei yra
- susieti point'ai tai suite

Pastaba:

- sis punktas nera toks svarbus kaip pilni planai, suite medis ir test points
- bet butu labai naudingas velesniam etapui

### 7. Work item kategoriju aptikimas

Naujas irankis:

- `list_work_item_categories`

Paskirtis:

- pagal `project` grazinti visas work item kategorijas ir su jomis susietus work item tipus

Pagal Azure DevOps dokumentacija kategorijos yra atskiras objektas, o projektas gali tureti ir custom work item tipus, todel nenoriu hardcodinti tik `Bug` ar `Incident`.

Noriu, kad irankis grazintu bent:

- `name`
- `referenceName`
- `defaultWorkItemType`
- `workItemTypes`
- `url`

Pagal oficialios Azure DevOps dokumentacijos pavyzdzius naudinga moketi aptikti tokias kategorijas:

- `Bug Category`
- `Feature Category`
- `Requirement Category`
- `Task Category`
- `Test Case Category`
- `Test Plan Category`
- `Test Suite Category`
- `Shared Step Category`
- `Shared Parameter Category`
- `Code Review Request Category`
- `Code Review Response Category`
- `Feedback Request Category`
- `Feedback Response Category`
- `Hidden Types Category`

Svarbu:

- projektas gali tureti custom tipus, pvz. `Incident`, `Issue`, `Feature request`, `Change`, `Problem` ir pan.
- todel MCP serveris turi moketi grazinti tiek kategorijas, tiek visus realiai tame projekte egzistuojancius tipus

### 8. Visu work item tipu aptikimas

Naujas irankis:

- `list_work_item_types`

Paskirtis:

- pagal `project` grazinti visus work item tipus, kurie tame projekte egzistuoja

Ko noriu atsakyme:

- `name`
- `referenceName`
- `description`
- `color`
- `icon`
- `isDisabled`
- `states` jei prieinama
- `fields` jei prieinama
- `categoryReferenceName` jei imanoma susieti
- `raw`

Svarbu:

- tai turi leisti suzinoti, ar konkretus projektas turi tokius tipus kaip `Incident`, `Issue`, `Bug`, `Feature`, `Task` ar kitus custom tipus

### 9. Isplestine work item paieska

Naujas irankis:

- `search_work_items_advanced`

Paskirtis:

- per MCP serveri uzklausti incidentus, bug'us, issue, feature request ir kitus work item pagal naudingu filtru rinkini

Privalomi filtrai, kuriuos noriu palaikyti:

- `project`
- `workItemTypes`
- `categoryReferenceNames`
- `categoryNames`
- `states`
- `assignedTo`
- `createdBy`
- `changedBy`
- `tags`
- `areaPaths`
- `iterationPaths`
- `text`

Papildomi naudingi filtrai:

- `ids`
- `priority`
- `severity`
- `reason`
- `createdDateFrom`
- `createdDateTo`
- `changedDateFrom`
- `changedDateTo`
- `closedDateFrom`
- `closedDateTo`
- `resolvedDateFrom`
- `resolvedDateTo`
- `externalStatus`
- `customerName`
- `serviceCaseId`
- custom field filtrai jei imanoma
- `top`
- `orderBy`

Tag filtru poreikis:

- filtruoti pagal viena taga
- filtruoti pagal kelis tagus
- tureti bent `tagsAny` ir `tagsAll` logika

Ko noriu rezultatuose:

- trumpa suvestine, tinkama sarasui
- arba pasirinktinai platesne schema, jei `includeFields` ar `expand` paprasoma

Svarbu:

- turi buti galima labai lengvai uzklausti tokius dalykus kaip:
- visi `Incident` su tam tikru tag'u
- visi `Bug`, kuriuos sukure konkretus zmogus
- visi item'ai, priskirti konkreciam asmeniui
- visi item'ai tam tikroje `Area Path`
- visi item'ai tarp datu

### 10. Pilnas vieno work item nuskaitymas

Naujas irankis:

- `get_work_item_full`

Paskirtis:

- pagal `id` arba `project + id` grazinti pilna pasirinkto bug / incident / issue / feature work item informacija

Ko noriu atsakyme:

- bazinius `System.*` laukus
- visus custom laukus
- `fields` kaip pilna key-value struktura
- `relations`
- `links`
- `commentVersionRef` ar pan. jei prieinama
- `url`
- `_links`
- `raw`

Papildomi optional parametrai:

- `expand`
- `includeRelations`
- `includeLinks`
- `includeComments`
- `includeUpdates`
- `includeRevisions`
- `includeAttachments`
- `includeRaw`

Svarbu:

- noriu matyti visa informacija, kuri yra bug'e ar incidente, ne tik santrauka
- tai turi veikti ir custom tipams, ne tik standartiniam `Bug`

### 11. Pilnas work item'u eksportas pagal filtrus

Naujas irankis:

- `export_work_items_full`

Paskirtis:

- pagal filtrus grazinti pilnai isplestus work item objektus, skirtus analizei ar eksportui

Naudingi input parametrai:

- visi `search_work_items_advanced` filtrai
- `includeComments`
- `includeUpdates`
- `includeRevisions`
- `includeAttachments`
- `includeRelations`
- `includeLinks`
- `includeRaw`
- `maxItems`

Ko noriu rezultate:

- `query`
- `totalMatched`
- `returned`
- `workItems`

Svarbu:

- jei reikia, bulk get turi buti daromas dalimis
- noriu tureti galimybe vienu kvietimu pasiimti pilna bug'u ar incidentu rinkini

### 12. Work item komentarai, istorija ir versijos

Nauji pagalbiniai irankiai:

- `list_work_item_comments`
- `list_work_item_updates`
- `list_work_item_revisions`

Paskirtis:

- gauti pilna papildoma informacija apie konkretaus work item komentaru istorija ir pakeitimu istorija

Ko noriu `list_work_item_comments`:

- visi komentarai
- `commentId`
- `text`
- `createdBy`
- `createdDate`
- `modifiedBy`
- `modifiedDate`
- `isDeleted`
- `url`
- paging / continuation apdorojimas

Ko noriu `list_work_item_updates`:

- pakeitimu istorija
- kokie laukai pasikeite
- kas pakeite
- kada pakeite
- relation ar link pakeitimai jei prieinama
- `raw`

Ko noriu `list_work_item_revisions`:

- visos work item versijos
- pilnesnis field snapshot per revision
- revision numeris
- datos
- `raw`

Svarbu:

- tai labai svarbu incidentu ir bug'u auditui
- noriu tureti galimybe matyti ne tik dabartine busena, bet ir visa pokyciu istorija

### 13. Work item saraso vaizdas kaip Azure DevOps UI

Papildomas noras:

- tureti iranki arba output schema, kuri butu patogi atkartoti Azure DevOps `Boards -> Work items` lentele

Laukai, kuriuos noriu patogiai gauti saraso vaizde:

- `id`
- `title`
- `assignedTo`
- `state`
- `areaPath`
- `tags`
- `commentCount`
- `activityDate`
- `createdBy`
- `workItemType`
- `priority`
- `severity`

Tai turi buti patogu ir `Incident`, ir `Bug`, ir `Feature request`, ir kitiems tipams.

## Papildomi norai pagal Azure DevOps UI

Kad MCP serveris butu tikrai naudingas darbui su `Test Plans`, noriu:

- matyti suite medi taip, kaip jis rodomas kaireje
- matyti pasirinktos suite `Execute` duomenis taip, kaip jie rodomi desineje
- matyti test point execution history su `outcome`, `test run`, `run by`, `time completed`
- moketi atsiversti konkretu run beveik taip, kaip Azure DevOps run perziuros lange
- ne tik santraukas, bet ir pilnesnius objektus
- galimybe veliau prideti `Define`, `Execute` ir galbut `Chart` susijusias uzklausas

## Papildomi norai Work Items / Bugs / Incidents sriciai

Kad MCP serveris butu tikrai naudingas darbui su `Boards -> Work items`, noriu:

- sugebeti dinamiskai nuskaityti work item kategorijas pagal Azure DevOps projekta
- sugebeti matyti, kokie konkretus work item tipai tame projekte egzistuoja
- uzklausti `Incident`, `Bug`, `Issue`, `Feature`, `Task` ir kitus tipus pagal tag'us, `created by`, `assigned to` ir kitus filtrus
- gauti pilna pasirinkto work item informacija, iskaitant custom laukus
- gauti work item komentaru istorija
- gauti work item pakeitimu istorija ir revisions
- vienu kvietimu eksportuoti daug pilnu work item objektu tolimesnei analizei
- nehardcodinti tik vieno proceso ar vienos work item tipu schemos

## Architekturinis vertinimas

Vertinant kaip vyresnysis MCP serveriu architektas ir pazenges Azure DevOps naudotojas:

- dabartinis serveris yra geras `read-only operational connector`, bet dar ne pilnaverte gilios analizes platforma
- dabartiniai irankiai gerai dengia bazinius projektu, repo, PR, work item, test, pipeline ir wiki scenarijus
- sis dokumentas jau apraso labai stipru pirmaji pletros etapa `Test Plans`, `Test Runs`, `Bugs`, `Incidents` ir `Work Items` sriciai
- taciau vien siu irankiu dar nepakanka didelio masto analizei tarp keliu projektu, problemai atsekti nuo simptomo iki kodo pakeitimo ir testavimo pasekmiu

Kol kas sis komplektas dar nera pilnai pakankamas siems use case:

- rasyti sudetingas kryzmines ataskaitas per kelis projektus
- patikimai susieti panasias problemas tarp skirtingu projektu
- analizuoti kokie PR, commit'ai ir failu pakeitimai is tikruju sprende konkrecia problema
- atsekti `User Story -> Test Case -> Test Run -> Bug / Incident -> PR / Commit`
- atlikti panasiu problemu klasterizacija ir tendenciju analize

Del to zemiau pridedamas papildomas architekturinis sluoksnis, kuris uzpildo butent tas spragas.

### 14. Traceability graph ir cross-project atsekamumas

Nauji irankiai:

- `get_work_item_relations_graph`
- `list_work_item_link_types`
- `get_traceability_chain`
- `list_linked_work_items`

Paskirtis:

- matyti ne tik viena work item, bet visa jo rysiu grafa
- atsekti priklausomybes tarp `Bug`, `Incident`, `Issue`, `Feature`, `User Story`, `Task`, `Test Case` ir kitu tipu
- tai daryti ir tarp skirtingu projektu

Ko noriu:

- visus relation tipus
- inbound ir outbound rysius
- gylio parametrus, pvz. `maxDepth`
- galimybe filtruoti pagal relation tipus
- galimybe grazinti normalizuota grafo struktura
- galimybe aptikti kryzminius projektinius rysius

Svarbu:

- be sio sluoksnio sunku atlikti pilna RCA ir impact analize
- dabartinis `get_cross_project_dependencies` yra naudingas, bet per siauras pilnam work item traceability vaizdui

### 15. Code change intelligence

Nauji irankiai:

- `get_pull_request_full`
- `list_pull_request_commits`
- `get_pull_request_diff`
- `get_commit_full`
- `search_pull_requests_by_work_item`
- `search_commits_by_work_item`

Paskirtis:

- susieti incidenta ar bug'a su realiais kodo pakeitimais
- matyti, kokie commit'ai ir PR sprende konkretu work item
- perziureti pakeistus failus ir diff'us analizei

Ko noriu:

- PR metaduomenis
- susietus work item
- commit'u sarasa
- failu sarasa
- diff / patch turini
- autorius
- merge data
- branch informacija
- statusus

Svarbu:

- be sio sluoksnio neimanoma pilnai atsakyti i klausima, kaip konkreti problema buvo istikruju istaisyta kode
- tai yra kritinis sluoksnis didelems analitinems uzklausoms

### 16. User story ir test coverage traceability

Nauji irankiai:

- `list_work_item_test_links`
- `get_user_story_test_coverage`
- `get_requirement_traceability_report`

Paskirtis:

- atsakyti, kurie `User Story` ar `Requirement` turi test case
- matyti, ar jie buvo vykdyti ir kokie yra rezultatai
- atsekti coverage grandine iki konkreciu run'u

Ko noriu:

- susietus `Test Case`
- susietus `Test Suite` ir `Test Plan`
- paskutinius `Test Run`
- coverage summary
- trukstamus testus
- neivykdytus testus
- failed testus

Svarbu:

- be sio sluoksnio negalima pilnai vertinti nauju `User Stories` testavimo brandos
- tai labai svarbu release readiness ir auditing scenarijams

### 17. Similarity ir duplicate detection

Nauji irankiai:

- `find_similar_work_items`
- `find_duplicate_candidates`
- `cluster_work_items_by_similarity`

Paskirtis:

- rasti panasias problemas tarp skirtingu projektu ar komponentu
- identifikuoti dublikatus ir pasikartojancias temas
- grupuoti incidentus, bug'us ir issue pagal panasu turini

Ko noriu:

- lyginima pagal `title`
- lyginima pagal `description`
- lyginima pagal `tags`
- lyginima pagal custom laukus
- lyginima pagal komponenta / area path
- lyginima pagal comments ir analysis tekstus jei imanoma
- similarity score
- paaiskinima, kodel irasai laikomi panasiais

Svarbu:

- tai nera tik retrieval uzdavinys, cia jau prasideda analitinis sluoksnis
- be sio sluoksnio sunku sistemingai aptikti pasikartojancias problemas

### 18. Discovery ir helper katalogai

Nauji irankiai:

- `list_work_item_fields`
- `list_area_paths`
- `list_iteration_paths`
- `list_tags`
- `resolve_identity`

Paskirtis:

- padeti kitoms uzklausoms veikti stabiliai ir be hardcode
- leisti dinamiskiems filtrams naudoti realiai egzistuojancius laukus, tagus, vartotojus, area path ir iteration path

Ko noriu:

- realiu lauku katalogo
- lauku reference names
- area path medzio
- iteration path medzio
- projektu tag'u saraso
- identity resolution pagal varda, email ar display name

Svarbu:

- be sio discovery sluoksnio advanced filtravimas tampa trapus
- tai ypac svarbu custom procesu ir custom lauku projektuose

### 19. Reporting ir dataset export sluoksnis

Nauji irankiai:

- `list_saved_queries`
- `run_saved_query`
- `export_work_items_delta`
- `export_traceability_dataset`

Paskirtis:

- generuoti duomenu rinkinius ataskaitoms ir ilgoms analitinems uzklausoms
- naudoti jau esamas Azure DevOps saved queries
- daryti delta eksportus nuo datos ar paskutinio atnaujinimo

Ko noriu:

- saved query sarasa
- saved query vykdyma
- eksportus pagal filtra arba query
- delta rezima
- atsekamumo dataset'us su work item, test ir code change sluoksniais

Svarbu:

- tai reikalinga ne tik interaktyviai uzklausai, bet ir didesniu ataskaitu generavimui
- be sio sluoksnio analizes bus per daug priklausomos nuo pavieniu gyvu uzklausu

### 20. Galutinis architekturinis verdictas

Po visu iki siol aprasytu papildymu serveris taptu:

- labai stipriu `ADO read-only analytics connector`
- tinkamu bazinems ir vidutinio sudetingumo analitinems uzklausoms
- geru pagrindu didesnei incidentu, bug'u, testavimo ir traceability analitikai

Taciau pilnaverciu komplektu didelems gilioms analizems ji laikyciau tik tada, kai bus igyvendinti visi sie sluoksniai:

- `Test Plans / Test Runs / Test Points` pilnas nuskaitymas
- `Work Items / Bugs / Incidents` pilnas nuskaitymas
- `Traceability graph`
- `Code change intelligence`
- `User story -> Test Case -> Test Run` atsekamumas
- `Similarity / duplicate detection`
- `Discovery / helper catalogs`
- `Reporting / dataset export`

Tik tada serveris bus tikrai tinkamas:

- rasyti ivairias ataskaitas
- susieti panasias problemas tarp skirtingu projektu
- analizuoti ankstesnius sprendimus ir ju kodo pakeitimus
- vertinti naujus `User Stories` kartu su susietais test case
- atlikti gilias ir dideles kryzmines analizes

## Vykdymo dokumentas

Detali faziu seka, checklists ir progreso zymejimas perkelti i [Implementation_Phases.md](C:/Users/gytis.miliauskas/OneDrive%20-%20Thermo%20Fisher%20Scientific/Old/Desktop/Codex/ADO%20MCP/Implementation_Phases.md).

## Techniniai reikalavimai implementacijai

- islaikyti `read-only` principa
- prideti normalizuotus laukus i `models.ts`
- jei reikia, prideti naujus mapperius i `src/domain/shared.ts`
- `src/domain/testManagement.ts` papildyti naujomis funkcijomis
- `src/domain/index.ts` prijungti naujas service funkcijas
- `src/mcp/server.ts` uzregistruoti naujus MCP irankius
- jei API rezultatai puslapiuojami, butinai apdoroti continuation / paging
- kur prasminga, leisti pasirinktinai gauti `raw` Azure DevOps atsaka
- prideti testus naujiems irankiams
- work item kategoriju ir tipu logikoje nehardcodinti tik `Bug`, nes projektuose gali buti custom tipai kaip `Incident`
- work item bulk nuskaityme atsizvelgti i Azure DevOps limitus vienam `workitems` request
- comments, updates ir revisions endpointams apdoroti paging jei jis yra
- WIQL generavime saugiai escapinti filtrus ir tag'us
- jei imanoma, work item fields laikyti ne tik normalizuotais laukais, bet ir pilnu `fields` zemelapiu
- traceability irankiams naudoti bendra grafo reprezentacija, o ne tik pavienius relation sarasus
- code intelligence sluoksnyje atskirti metaduomenis nuo pilno diff turinio, kad butu galima valdyti payload dydi
- user story / test coverage irankiams islaikyti nuoseklu rysiu modeli tarp `Requirement`, `User Story`, `Test Case`, `Test Suite`, `Test Run`
- similarity irankiams tureti aisku scoring modeli ir paaiskinama rezultatu struktura
- discovery irankiai turi veikti kaip pagalbinis katalogu sluoksnis kitiems toolams, ne tik kaip pavieniai lookup endpointai
- reporting sluoksnyje numatyti dideliu eksportu chunking, delta logika ir stabilius dataset formatus

## Sekmes kriterijus

Po atnaujinimo noriu, kad MCP serveris galetu:

- paimti viena konkretu test plana pilniau nei dabar
- grazinti visa to plano suite medi
- grazinti vienos suite pilna `Execute` lentele su test points
- vienu kvietimu eksportuoti pilna plano struktura tolimesnei analizei
- uzklausti bug'us, incidentus ir kitus work item tipus pagal prasmingus filtrus
- grazinti pilna pasirinkto work item informacija su custom laukais
- eksportuoti didesni work item rinkini pilnai analizei
- atsekti rysius tarp work item per kelis projektus
- susieti problemas su PR, commit ir failu pakeitimais
- matyti `User Story -> Test Case -> Test Run` coverage grandine
- aptikti panasias ir galimai dubliuotas problemas
- tureti discovery ir reporting sluoksni didelems analitems uzklausoms

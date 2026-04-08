# Implementation Phases

Sis dokumentas skirtas vykdymui ir progreso sekimui.

Statusu legenda:

- `[ ]` TODO
- `[x]` DONE
- `[-]` IN PROGRESS
- `[~]` BLOCKED / NEEDS DECISION

## Phase overview

### Phase 1A. Foundation analytics core

Status: `[x]` DONE

Tikslas:

- igyvendinti pagrindinius `Test Plans / Runs / Points` ir `Work Items / Bugs / Incidents` full retrieval irankius

MCP irankiai:

- [x] `get_test_plan`
- [x] `get_test_plan_suites_tree`
- [x] `get_test_suite`
- [x] `list_test_points`
- [x] `get_test_point_history`
- [x] `get_test_run_full`
- [x] `export_test_plan_full`
- [x] `list_work_item_categories`
- [x] `list_work_item_types`
- [x] `search_work_items_advanced`
- [x] `get_work_item_full`
- [x] `export_work_items_full`

### Phase 1B. Detailed retrieval and audit

Status: `[x]` DONE

Tikslas:

- uzdengti detalesnius audit ir papildomo retrieval scenarijus

MCP irankiai:

- [x] `list_test_cases_full`
- [x] `list_work_item_comments`
- [x] `list_work_item_updates`
- [x] `list_work_item_revisions`

### Phase 2. Traceability and code intelligence

Status: `[x]` DONE

Tikslas:

- sujungti work items, testus ir kodo pakeitimus i viena analitini sluoksni

MCP irankiai:

- [x] `get_work_item_relations_graph`
- [x] `list_work_item_link_types`
- [x] `get_traceability_chain`
- [x] `list_linked_work_items`
- [x] `get_pull_request_full`
- [x] `list_pull_request_commits`
- [x] `get_pull_request_diff`
- [x] `get_commit_full`
- [x] `search_pull_requests_by_work_item`
- [x] `search_commits_by_work_item`
- [x] `list_work_item_test_links`
- [x] `get_user_story_test_coverage`
- [x] `get_requirement_traceability_report`

### Phase 3. Advanced analytics

Status: `[x]` DONE

Tikslas:

- tureti discovery, similarity ir reporting orientuota MCP sluoksni

MCP irankiai:

- [x] `find_similar_work_items`
- [x] `find_duplicate_candidates`
- [x] `cluster_work_items_by_similarity`
- [x] `list_work_item_fields`
- [x] `list_area_paths`
- [x] `list_iteration_paths`
- [x] `list_tags`
- [x] `resolve_identity`
- [x] `list_saved_queries`
- [x] `run_saved_query`
- [x] `export_work_items_delta`
- [x] `export_traceability_dataset`

## Cross-cutting tasks

### A. Foundation preparation

Status: `[ ]` TODO

- [ ] ivertinti ir surasyti visus Azure DevOps REST endpointus, reikalingus `Test Plans`, `Test Runs`, `Work Items`, `Traceability`, `PR`, `Commit`, `Comments`, `Updates`, `Revisions`, `Saved Queries`
- [ ] apsispresti del bendro response dizaino: normalizuoti laukai + optional `raw`
- [ ] apsispresti del bendros paging / continuation strategijos
- [ ] apsispresti del bendros bulk-fetch strategijos, kai ADO turi request limitus
- [ ] apsispresti del bendros klaidu ir partial failure strategijos

### B. Models and data structures

Status: `[x]` DONE

- [ ] praplesti `src/models.ts` naujais `Test Plan`, `Test Suite`, `Test Point`, `Test Point History`, `Test Run Full`, `Work Item Full`, `PR`, `Commit`, `Traceability`, `Coverage`, `Similarity`, `Discovery`, `Reporting` modeliais
- [ ] apsispresti kurie modeliai turi tureti `summary` ir kurie `full` versijas
- [ ] visur, kur reikia, prideti `raw` laukus
- [x] sukurti bendra grafo reprezentacija traceability scenarijams
- [ ] sukurti bendra similarity rezultatu reprezentacija su score ir explanation
- [ ] sukurti stabilius export dataset formatus

### C. Mappers and domain helpers

Status: `[-]` IN PROGRESS

- [ ] praplesti `src/domain/shared.ts` naujais mapperiais visiems naujiems modeliams
- [x] sukurti helperius ADO relation tipu normalizavimui
- [ ] sukurti helperius work item field katalogui ir custom lauku skaitymui
- [ ] sukurti helperius test coverage grandinei normalizuoti
- [ ] sukurti helperius similarity skaiciavimui ar kandidatu formavimui
- [ ] sukurti helperius saved query ir delta export rezultatams

### D. Domain services

Status: `[x]` DONE

- [x] praplesti `src/domain/testManagement.ts` visais naujais testu srities irankiais
- [x] praplesti `src/domain/workItems.ts` visais naujais work item paieskos ir full retrieval irankiais
- [x] sukurti arba praplesti atskira domeno sluoksni traceability scenarijams
- [x] sukurti arba praplesti atskira domeno sluoksni PR / commit intelligence scenarijams
- [x] sukurti arba praplesti atskira domeno sluoksni discovery scenarijams
- [x] sukurti arba praplesti atskira domeno sluoksni reporting / export scenarijams
- [x] sukurti arba praplesti atskira domeno sluoksni similarity scenarijams

### E. Service wiring

Status: `[x]` DONE

- [x] praplesti `src/domain/index.ts` visais naujais service metodais
- [x] uztikrinti, kad visi nauji servisai gerbtu project allowlist logika
- [x] uztikrinti, kad cross-project servisai teisingai validuotu prieigas

### F. MCP registration

Status: `[x]` DONE

- [x] uzregistruoti visus naujus toolus `src/mcp/server.ts`
- [x] kiekvienam naujam toolui apibrezti aisku `inputSchema`
- [x] kiekvienam naujam toolui apibrezti aisku `outputSchema`
- [x] kiekvienam naujam toolui apibrezti naudinga `description`
- [x] kur prasminga, naudoti optional `includeRaw`, `includeComments`, `includeUpdates`, `includeRevisions`, `expand`, `maxDepth`, `top`, `orderBy`

### G. Paging, performance and stability

Status: `[-]` IN PROGRESS

- [ ] ivendinti continuation / paging ten, kur ADO API ji naudoja
- [ ] ivendinti chunking bulk `workitems` requestams
- [ ] ivendinti chunking dideliems export scenarijams
- [ ] valdyti payload dydi, ypac `raw`, `diff`, `comments`, `revisions`, `attachments` scenarijuose
- [ ] apsispresti del optional lazy-load ar nested fetch elgesio dideliems toolams
- [ ] uztikrinti, kad dideli exportai butu stabilus ir nenumustu serverio

Progress notes:

- [x] sutvarkytas `search_work_items` rezultatu eiles islaikymas po bulk `workitems` fetch
- [x] sutvarkytas `search_work_items_advanced` rezultatu eiles islaikymas po bulk `workitems` fetch
- [x] `get_work_item_full` default kelias padarytas lengvas, o sunkesni payload skyriai kraunami tik pagal `include*` / `expand`
- [x] `get_test_plan_suites_tree` apdoroja suite continuation puslapiavima ir grazina rekursini medi
- [x] `list_test_points`, `get_test_point_history` ir `get_test_run_full` apdoroja skip/top paging test point, run ir result retrieval keliuose
- [x] `list_work_item_comments` apdoroja continuation paging ir grazina auditui tinkama komentaru istorija
- [x] `list_work_item_updates` ir `list_work_item_revisions` apdoroja skip/top paging ir grazina pilna istorija su optional `raw`
- [x] `export_work_items_full` naudoja batchintus base `workitems` fetchus, islaiko WIQL tvarka ir reuse'ina full retrieval building blocks
- [x] `export_test_plan_full` reuse'ina test-management retrieval building blocks ir valdo optional nested sekcijas per include flag'us
- [x] `list_test_cases_full` reuse'ina suite entry ir point retrieval building blocks, batchina work item field fetchus ir enrichina test case duomenis steps / parameters / shared steps / linked points sluoksniu
- [x] code intelligence slicas valdo `raw` ir `patch` payloadus caller-controlled `includeRaw` / `includePatch` flag'ais
- [x] `get_commit_full` ir `search_commits_by_work_item` apdoroja commit change paging per skip/top ir negriauna payload dydzio, kai patch nera paprasytas
- [x] `export_work_items_delta` reuse'ina advanced search ir full export building blocks, islaiko tvarka ir caller-controlled budu krauna optional updates / revisions
- [x] `export_traceability_dataset` palaiko caller-controlled include flag'us ir chunkable analytics scope, apjungdamas work items, test traceability, coverage, PR ir commit sluoksnius

### H. WIQL and filtering logic

Status: `[-]` IN PROGRESS

- [x] isplesti WIQL generavima advanced filtrams
- [x] saugiai escapinti visus tekstinius filtrus ir tag'us
- [x] prideti filtrus pagal `tagsAny` ir `tagsAll`
- [x] prideti filtrus pagal `createdBy`, `assignedTo`, `changedBy`
- [x] prideti filtrus pagal `areaPath`, `iterationPath`, `state`, `reason`
- [x] prideti datu filtrus
- [ ] prideti custom field filtrus ten, kur tai imanoma
- [x] prideti stabilu `orderBy` modeli

Progress notes:

- [x] stabilizavimo slice metu patvirtintas WIQL tvarkos islaikymas galutiniame MCP output po antrinio bulk fetch

### I. Traceability and coverage logic

Status: `[x]` DONE

- [x] sukurti relation traversal logika keliu lygiu gyliui
- [x] sukurti `User Story -> Test Case -> Test Run` coverage traversal logika
- [x] sukurti cross-project relation aptikima
- [x] sukurti impact / dependency / traceability rezultatu normalizavima

Progress notes:

- [x] `list_work_item_test_links` sujungia tiesioginius work item test relation'us su optional `Test Point -> Test Suite -> Test Plan -> Test Run` enrichment'u per caller-controlled `include*` flag'us
- [x] `list_work_item_test_links` palaiko cross-project test case konteksta, kai susieti testai priklauso allowlist'e esantiems projektams
- [x] `get_user_story_test_coverage` reuse'ina `list_work_item_test_links` kaip bazini traceability building block ir tik papildomai krauna run results, kai reikia coverage outcome skaiciavimui
- [x] `get_user_story_test_coverage` grazina analitini coverage vaizda su linked test case, suite / plan rollup'ais, recent run suvestinemis ir bendru coverage statusu
- [x] `get_requirement_traceability_report` reuse'ina `get_user_story_test_coverage` ir prideda requirement lygio gap / risk / traceability verdict sluoksni be papildomos traversal logikos
- [x] `get_requirement_traceability_report` grazina aisku `traceabilityStatus` ir `gaps` vaizda release readiness bei auditing scenarijams

### J. Code intelligence logic

Status: `[x]` DONE

- [x] sukurti PR ir commit paieska pagal work item
- [x] sukurti diff ir patch retrieval logika
- [x] sukurti failu pakeitimu santraukos logika
- [x] sukurti work item <-> PR <-> commit susiejimo logika

Progress notes:

- [x] `search_pull_requests_by_work_item` reuse'ina work item relation retrieval ir is work item artifact link'u isveda PR identitetus be dubliuotos traversal logikos
- [x] `get_pull_request_full` caller-controlled budu krauna reviewers ir linked work items, o linked work items papildomai filtruojami pagal allowlist
- [x] `list_pull_request_commits` ir `get_pull_request_diff` remiasi ta pacia PR konteksto validacija, kad repository / project mismatch butu aptinkamas nuosekliai
- [x] `get_pull_request_diff` valdo payload dydi per `includePatch` ir `includeRaw`, o failu santrauka renka per iteration changes retrieval
- [x] `get_commit_full` caller-controlled budu krauna changed files, stats ir optional patch / raw payloadus
- [x] `search_commits_by_work_item` reuse'ina work item -> PR paieska, papildomai aptinka tiesioginius commit artifact link'us ir deduplikuoja commit'us per kelis PR

### K. Similarity analytics logic

Status: `[x]` DONE

- [x] apibrezti similarity scoring taisykles
- [x] apibrezti duplicate candidate taisykles
- [x] apibrezti clustering strategija
- [x] sukurti explanation struktura, kodel item'ai laikomi panasiais
- [x] apsispresti, kuri dalis similarity logikos bus deterministic, o kuri heuristic

Progress notes:

- [x] `find_similar_work_items` naudoja deterministinius signalus: `title`, `description`, `tags`, `areaPath`, `iterationPath`, `workItemType`, `assignedTo`, `createdBy`, pasirinktus custom laukus ir shared artifact link'us
- [x] similarity rezultatai visada grazina paaiskinamus `reasons`, o ne juodos dezes score
- [x] `find_duplicate_candidates` remiasi tuo paciu signalu rinkiniu, bet duplicate scoring papildomai boost'ina stiprius sutapimus ir grazina `signals`
- [x] `cluster_work_items_by_similarity` grupuoja item'us pagal porini similarity grafa ir grazina analytics-friendly klasterius su `summary`, `commonSignals` ir optional `raw`

### L. Discovery and reporting logic

Status: `[x]` DONE

- [x] sukurti work item field katalogo retrieval
- [x] sukurti area path ir iteration path medzio retrieval
- [x] sukurti tag katalogo retrieval
- [x] sukurti identity resolution logika
- [x] sukurti saved query discovery ir vykdymo logika
- [x] sukurti delta export logika
- [x] sukurti traceability dataset export logika

Progress notes:

- [x] `list_work_item_fields` grazina analytics-friendly lauku kataloga su `referenceName`, tipu, identity / picklist zymemis, optional `supportedOperations` ir caller-controlled `includeRaw`
- [x] `list_area_paths` ir `list_iteration_paths` palaiko tiek `tree`, tiek `flat` rezimus, `depth` valdyma ir nuoseklu classification node normalizavima kitiems Phase 3 analytics toolams
- [x] `list_tags` palaiko caller-controlled `search`, `top` ir `includeRaw`, kad tag katalogas butu tinkamas dinaminiams filtrams ir discovery UI sluoksniams
- [x] `resolve_identity` grazina tiketiniausius identity kandidatus pagal free-text query ir palaiko optional project-based allowlist boundary
- [x] `list_saved_queries` grazina analytics-friendly saved query ir query folder hierarchija su nuosekliu `tree` / `flat` rezimu, `depth` valdymu bei optional `wiql` ir `raw`
- [x] `run_saved_query` palaiko query resolve tiek per `queryId`, tiek per `path`, vykdo issaugota query ir optional budu reuse'ina esama work-item retrieval sluoksni per `includeWorkItems` ir `expand`
- [x] `export_work_items_delta` eksportuoja work item scope nuo `changedSince` / `fromDate` watermark'o ir caller-controlled budu prideda full work items, updates bei revisions
- [x] `export_traceability_dataset` generuoja analytics-friendly dataset per search arba saved query scope ir optional budu prideda work items, test links, coverage, PR bei commit sluoksnius

### M. Tests

Status: `[-]` IN PROGRESS

- [ ] prideti unit testus visiems naujiems mapperiams
- [ ] prideti unit testus visiems naujiems WIQL builderiams
- [ ] prideti unit testus similarity scoring logikai
- [ ] prideti service lygio testus kiekvienam naujam toolui
- [ ] prideti MCP registracijos testus naujiems toolams
- [ ] prideti pagination / chunking testus
- [ ] prideti allowlist ir cross-project access testus
- [ ] prideti error handling testus

Progress notes:

- [x] prideti `search_work_items_advanced` WIQL builder unit testus
- [x] prideti `search_work_items_advanced` service lygio testus
- [x] prideti `search_work_items_advanced` MCP registracijos testa
- [x] prideti `get_work_item_full` mapper / service / MCP testus
- [x] prideti `search_work_items` order-preservation service testa
- [x] prideti `search_work_items_advanced` order-preservation service testa
- [x] prideti `get_work_item` allowlist boundary service testa
- [x] prideti `get_work_item_full` allowlist boundary ir payload-control service testus
- [x] prideti traceability traversal unit testus
- [x] prideti `list_linked_work_items` flattening unit testa
- [x] prideti `list_work_item_link_types` service testa
- [x] prideti `get_work_item_relations_graph` service testa
- [x] prideti `get_traceability_chain` service testa
- [x] prideti `list_linked_work_items` service testa
- [x] prideti Phase 2 traceability MCP registracijos testa
- [x] praplesti Phase 2 traceability MCP registracijos testa su `list_linked_work_items`
- [x] prideti MCP schema reject/accept testus whitespace-only inputams ir blogoms datoms
- [x] prideti `list_work_item_types` includeRaw mapper / service testus
- [x] prideti service testus `list_work_item_comments`, `list_work_item_updates`, `list_work_item_revisions`
- [x] prideti `export_work_items_full` filtravimo, tvarkos, include sekciju ir batching testus
- [x] prideti MCP registracijos / schema testus naujiems work item audit ir export toolams
- [x] prideti unit testus `get_test_plan_suites_tree` rekursijai ir pasirinktu root suite subtree generavimui
- [x] prideti service testus `get_test_plan`, `get_test_plan_suites_tree`, `get_test_suite`, `list_test_points`, `get_test_point_history`, `get_test_run_full`, `export_test_plan_full`
- [x] prideti allowlist boundary testus naujiems Phase 1A test-management toolams
- [x] prideti MCP registracijos ir schema testus naujiems Phase 1A test-management toolams
- [x] prideti unit testus `list_test_cases_full` steps / parameters parseriams
- [x] prideti service ir allowlist boundary testus `list_test_cases_full`
- [x] prideti MCP registracijos ir schema testus `list_test_cases_full`
- [x] prideti service testus `list_work_item_test_links`, iskaitant cross-project enrichment ir include flag'u payload control
- [x] prideti allowlist boundary testa `list_work_item_test_links`
- [x] prideti MCP registracijos ir schema testus `list_work_item_test_links`
- [x] prideti service testus `get_user_story_test_coverage`, iskaitant mixed outcomes, no-tests ir no-context edge case'us
- [x] prideti allowlist boundary testa `get_user_story_test_coverage`
- [x] prideti MCP registracijos ir schema testus `get_user_story_test_coverage`
- [x] prideti service testus `get_requirement_traceability_report`, iskaitant complete, missing_tests, missing_execution, partial ir at_risk scenarijus
- [x] prideti MCP registracijos ir schema testus `get_requirement_traceability_report`
- [x] prideti code intelligence helper testus PR artifact link parsing ir diff file mapping logikai
- [x] prideti service testus `search_pull_requests_by_work_item`, `get_pull_request_full`, `list_pull_request_commits`, `get_pull_request_diff`
- [x] prideti allowlist, cross-project skip bei repository / project mismatch testus code intelligence toolams
- [x] prideti MCP registracijos ir schema testus `search_pull_requests_by_work_item`, `get_pull_request_full`, `list_pull_request_commits`, `get_pull_request_diff`
- [x] prideti helper testus commit artifact link parsing ir commit stats logikai
- [x] prideti service testus `get_commit_full` ir `search_commits_by_work_item`, iskaitant no-PR, multi-PR, shared commit dedupe, patch ir allowlist / mismatch scenarijus
- [x] prideti MCP registracijos ir schema testus `get_commit_full` ir `search_commits_by_work_item`
- [x] prideti discovery helper testus classification tree / flat transformacijai ir identity ranking logikai
- [x] prideti service testus `list_work_item_fields`, `list_area_paths`, `list_iteration_paths`, `list_tags`, `resolve_identity`
- [x] prideti allowlist boundary testus discovery toolams, kur projektinis scope yra aktualus
- [x] prideti MCP registracijos ir schema testus `list_work_item_fields`, `list_area_paths`, `list_iteration_paths`, `list_tags`, `resolve_identity`
- [x] prideti reporting helper testus saved query hierarchy flatten / resolve ir work item id extraction logikai
- [x] prideti service testus `list_saved_queries` ir `run_saved_query`, iskaitant `tree` / `flat`, `includeWiql`, `queryId` vs `path`, `includeWorkItems`, `top` ir allowlist boundary scenarijus
- [x] prideti MCP registracijos ir schema testus `list_saved_queries` ir `run_saved_query`
- [x] prideti service testus `export_work_items_delta` ir `export_traceability_dataset`, iskaitant delta watermark, optional include sekcijas, saved query scope ir allowlist boundary scenarijus
- [x] prideti unit testus similarity scoring ir clustering helperiams
- [x] prideti service testus `find_similar_work_items`, `find_duplicate_candidates` ir `cluster_work_items_by_similarity`
- [x] prideti MCP registracijos ir schema testus similarity toolams

### N. Documentation

Status: `[x]` DONE

- [x] atnaujinti `README.md` su naujomis galimybemis
- [x] atnaujinti `USAGE.md` su nauju toolu pavyzdziais
- [x] aprasyti skirtuma tarp `summary` ir `full` toolu
- [x] aprasyti rekomenduojama naudojima dideliems exportams
- [x] aprasyti `Phase 1A`, `Phase 1B`, `Phase 2`, `Phase 3` paskirtis

Progress notes:

- [x] atnaujintas `Implementation_Phases.md` su `search_work_items_advanced` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su `get_work_item_full` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su Phase 2 traceability progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su `list_linked_work_items` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su work-item stabilization slice progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su `Phase 1B` uzdarymu ir `list_test_cases_full` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su Phase 3 discovery slice progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su Phase 3 saved query/reporting slice progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su `list_work_item_test_links` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su `get_user_story_test_coverage` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su `get_requirement_traceability_report` progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su pirmu Phase 2 code intelligence slicu ir 4 PR toolu progreso zymejimu
- [x] atnaujintas `Implementation_Phases.md` su commit intelligence uzbaigimu ir Phase 1 + Phase 2 verification / hardening pass rezultatais
- [x] atnaujintas `Implementation_Phases.md` su Phase 3 export ir similarity sluoksnio uzbaigimu
- [x] atnaujintas `README.md` su release-ready paleidimo, autentikacijos, tool group ir known limitations aprasymais
- [x] atnaujintas `USAGE.md` su praktiniais usage pattern'ais, `summary` vs `full` skirtumu ir export rekomendacijomis
- [x] sukurtas `TOOLS_REFERENCE.md` su pilnu MCP tool katalogu ir smoke test checklist

### O. Final validation

Status: `[x]` DONE

- [x] perziureti, ar visi `To_add.md` aprasyti toolai yra implementuoti
- [x] perziureti, ar visi sekmes kriterijai yra padengti
- [x] perziureti, ar visos fazes turi testus ir dokumentacija
- [x] perziureti, ar serveris isliko grieztai `read-only`
- [x] parengti galutini validation checklist pries naudojima realioms didelems analizems

Progress notes:

- [x] atliktas `Phase 1` + `Phase 2` verification / hardening pass: sulyginti MCP tool statusai su realiu repo state
- [x] verification metu patvirtinta, kad Phase 1 ir Phase 2 sluoksniuose serveris islieka grieztai `read-only`
- [x] atliktas pilnas tool inventory sutikrinimas tarp `To_add.md`, `Implementation_Phases.md`, `src/mcp/server.ts` ir `src/domain/index.ts`
- [x] sugrieztintas inventory testas MCP registracijai ir pridetas pilno service wiring pavirsiaus testas
- [x] paruostas release-ready dokumentacijos rinkinys: `README.md`, `USAGE.md`, `TOOLS_REFERENCE.md`
- [x] parengtas praktinis smoke test checklist realiam ADO PAT / projekto validavimui
- [x] atviri bendri checklist punktai sekcijose `A`, `C`, `G`, `H` ir `M` laikomi istoriniu engineering backlog sluoksniu, o ne aktyviais blokatoriais sios release scope tool inventory

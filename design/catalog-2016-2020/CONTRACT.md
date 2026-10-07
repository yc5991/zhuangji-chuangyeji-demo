# First-phase reference catalog contract

This catalog is design research for 2016-01 through 2020-12. It never changes the 32-entry Demo catalog. Files are drafts, not a claim to enumerate every historical SKU.

Each category JSON contains schemaVersion: 1, status: draft, phase: {from: 2016-01, through: 2020-12}, sources: [], products: [], brandCoverage: [], events: [], exclusions: [], gaps: [].

Source: {id, title, url, publisher, evidenceScope, checkedDate}. Use manufacturer sources actually opened through the web tool. Distinguish announcement, availability, specification and current-page evidence. Current pages do not prove historic first-sale dates.

Product: {id, category, brandId, realModel, realSeries, gameName: {seriesId, seriesZh, seriesEn, model}, release: {date: YYYY-MM-DD | YYYY-MM | YYYY-Qn | YYYY | null, precision: day | month | quarter | year | unknown, kind: retail_availability | announcement | existing_before_phase | estimated_window, status: verified | inferred | unresolved, sourceIds: []}, gameAvailability: {from: YYYY-MM, through: YYYY-MM | null, basis: verified_launch_month | existing_stock_assumption | supply_window_assumption, note}, specs: {}, verifiedFields: [], inferredFields: [], sourceIds: [], tier: entry | mainstream | performance | flagship | specialist, useCases: [], workshopNotes: [], variants: []}.

IDs use domain prefixes (cm_, gpu_, ms_, sc_) and stable ASCII. Categories: cpu, motherboard, gpu, ram, storage, psu, cooler, case. brandId must exist in ../brands.json. Series may be new candidates, but do not edit the central product-series file. Existing series names should be preserved. Each different board partner is its own product and brandId. A GPU has specs.graphicsPlatformBrandId, coreSeries, vramGB, powerConnectors, dimensionsMm where known. Its physical board revision is separate from graphics core release.

Do not silently assign a family launch date to a later physical variant. Null first-sale date is allowed; game supply month may be an explicit inference. Grouping variants by capacity/color is allowed when shared model characteristics are documented; different interface/socket/chip architecture needs a different row. Family aggregates should say family in realModel and list representativeModels in specs, never invent a precise model.

Do not invent specifications or cite an unopened URL. Unknown technical fields are null and appear in gaps. Inferred physical attributes are recorded in inferredFields with a nearby reason. Gameplay scores, prices and failure rates are excluded from this reference catalog. Game series names, supply lag and workshop positioning are creative design candidates.

brandCoverage: {brandId, roles: [], status: researched | partial | upstream_only | group_only | outside_phase | unresolved, productIds: [], note, sourceIds: []}. Cover every assigned registry brand even if no eligible product exists. Unverified old availability is partial/unresolved, never an established fact. First-phase exclusion does not remove full-game placeholders.

Event: {id, month: YYYY-MM, type, title, productIds: [], sourceIds: [], status: verified | inferred, procurementEffect}. Exclusion: {brandId, category, notBefore: YYYY-MM | null, reason, sourceIds: []}. Gaps are explicit {subject, missingEvidence, gameResolution} records.

Write only your assigned category JSON and Markdown review. Do not modify central registry, existing Demo data, economics/workbench/art files, AGENTS.md, package.json or other agents' outputs. Read AGENTS.md and relevant writing skills. Keep Chinese document prose readable, avoid Chinese full stops, caption/center tables, cite sources near claims, and run the Chinese document checker before reporting completion. At least one official source per key platform generation, with deeper technical sources for compatibility traps. Tell root when data is written, then validate local JSON shape and referential integrity.

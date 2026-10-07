// Validate research provenance and calendar bounds before these drafts become game data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const files = ['cpu-motherboard.json', 'gpu.json', 'memory-storage.json', 'structural.json'];
const categories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'cooler', 'case'];
const role = {cpu:'cpu',motherboard:'motherboard',gpu:'gpu_board',ram:'ram',storage:'storage',psu:'psu',cooler:'cooler',case:'case'};
const monthPattern = /^(20\d\d)-(0[1-9]|1[0-2])$/;
const knownKind = new Set(['retail_availability','announcement','existing_before_phase','estimated_window']);
const knownStatus = new Set(['verified','inferred','unresolved']);
const normalizeField = name => name.replace(/^specs\./, '');

// A coarse date gives only its earliest possible month; it never proves an exact day.
function earliestMonth(release) {
  if (!release.date) return null;
  if (release.precision === 'day') {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(release.date), 'Invalid day syntax');
    const parsed = new Date(`${release.date}T00:00:00Z`);
    assert(!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10)===release.date, 'Invalid calendar date');
    return release.date.slice(0,7);
  }
  if (release.precision === 'month') {
    assert(monthPattern.test(release.date), 'Invalid release month');
    return release.date;
  }
  if (release.precision === 'quarter') {
    assert(/^20\d\d-Q[1-4]$/.test(release.date), 'Invalid release quarter');
    return `${release.date.slice(0,4)}-${String((Number(release.date.slice(-1))-1)*3+1).padStart(2,'0')}`;
  }
  assert(release.precision === 'year' && /^20\d\d$/.test(release.date), 'Invalid release precision');
  return `${release.date}-01`;
}

function run() {
  const brands = read('design/brands.json').brands;
  const byBrand = new Map(brands.map(b => [b.id,b]));
  const existingSeries = new Map(read('design/product-series.json').series.map(s=>[s.id,s]));
  const candidateSeries = new Map();
  const allProducts = new Map();
  const covered = new Set();
  const warnings = [];
  const counts = Object.fromEntries(categories.map(c=>[c,0]));
  const reports = [];
  const events = [];

  // Cross-reference every source, supplier, series and product within each research file.
  for (const file of files) {
    const doc = read(`design/catalog-2016-2020/${file}`);
    assert.equal(doc.schemaVersion,1,`${file}: schema`);
    assert.equal(doc.phase.from,'2016-01',`${file}: phase start`);
    assert.equal(doc.phase.through,'2020-12',`${file}: phase end`);
    for (const key of ['sources','products','brandCoverage','events','exclusions','gaps']) assert(Array.isArray(doc[key]),`${file}: ${key}`);
    const sources = new Map(doc.sources.map(s=>[s.id,s]));
    assert.equal(sources.size,doc.sources.length,`${file}: duplicate source id`);
    for (const source of doc.sources) {
      assert(/^https:\/\//.test(source.url),`${file}: source URL`);
      assert(source.title && source.publisher && source.evidenceScope && source.checkedDate,`${file}: incomplete source ${source.id}`);
    }
    const checkSources = (ids, subject) => {
      assert(Array.isArray(ids), `${file}: source array ${subject}`);
      for (const id of ids) assert(sources.has(id),`${file}: unknown source ${id} in ${subject}`);
    };
    const local = new Map(doc.products.map(p=>[p.id,p]));
    assert.equal(local.size,doc.products.length,`${file}: duplicate product id`);
    for (const product of doc.products) {
      assert(!allProducts.has(product.id),`Duplicate global product ${product.id}`);
      allProducts.set(product.id,product);
      const brand = byBrand.get(product.brandId);
      assert(brand,`${product.id}: unknown supplier`);
      assert(categories.includes(product.category),`${product.id}: unknown category`);
      assert(brand.roles.includes(role[product.category]) || (product.category==='gpu' && brand.roles.includes('graphics_platform')),`${product.id}: role absent from registry`);
      assert(!['holding_group','component_vendor'].includes(brand.entityKind),`${product.id}: non-retail entity cannot be a component SKU`);
      assert(product.realModel && product.realSeries !== undefined,`${product.id}: reference identity`);
      assert(product.gameName?.seriesId && product.gameName?.seriesZh && product.gameName?.model,`${product.id}: game series identity`);
      assert(/^[a-z0-9_]+$/.test(product.gameName.seriesId),`${product.id}: series id must be stable ASCII`);
      const series = {brandId:product.brandId,zh:product.gameName.seriesZh,en:product.gameName.seriesEn};
      if (existingSeries.has(product.gameName.seriesId)) {
        const existing = existingSeries.get(product.gameName.seriesId);
        assert.deepEqual(series,{brandId:existing.brandId,zh:existing.zh,en:existing.en},`${product.id}: changed existing series identity`);
      }
      if (candidateSeries.has(product.gameName.seriesId)) assert.deepEqual(series,candidateSeries.get(product.gameName.seriesId),`${product.id}: conflicting candidate series`);
      else candidateSeries.set(product.gameName.seriesId,series);
      assert(product.specs && typeof product.specs==='object',`${product.id}: specs`);
      assert(Array.isArray(product.verifiedFields) && Array.isArray(product.inferredFields),`${product.id}: field provenance`);
      const verified = new Set(product.verifiedFields.map(normalizeField));
      for (const field of product.verifiedFields) {
        const chain = field.split('.');
        const value = chain.length>1 ? chain.reduce((o,key)=>o?.[key],product) : Object.hasOwn(product.specs,field) ? product.specs[field] : product[field];
        assert(value!==null && value!==undefined,`${product.id}: verified field is unknown: ${field}`);
      }
      for (const field of product.inferredFields) assert(!verified.has(normalizeField(field)),`${product.id}: field both verified and inferred: ${field}`);
      checkSources(product.sourceIds, product.id);
      if (file==='memory-storage.json') {
        assert(!product.sourceIds.includes('samdocs') || product.brandId==='samsong',`${product.id}: Samsung directory cannot verify another supplier`);
        assert(!product.sourceIds.includes('barracuda') || product.brandId==='seagait',`${product.id}: Seagate support cannot verify another supplier`);
      }
      if (product.verifiedFields.length) assert(product.sourceIds.length,`${product.id}: verified fields without source`);
      assert(knownStatus.has(product.release.status) && knownKind.has(product.release.kind),`${product.id}: release provenance`);
      checkSources(product.release.sourceIds,`${product.id} release`);
      if (product.release.status==='verified') assert(product.release.date && product.release.sourceIds.length,`${product.id}: verified release without dated evidence`);
      if (product.release.date===null) assert.equal(product.release.precision,'unknown',`${product.id}: unknown date precision`);
      const from = product.gameAvailability.from;
      assert(monthPattern.test(from) && from>='2016-01' && from<='2020-12',`${product.id}: supply outside first phase`);
      assert(product.gameAvailability.note && ['verified_launch_month','existing_stock_assumption','supply_window_assumption'].includes(product.gameAvailability.basis),`${product.id}: supply provenance`);
      const lower = earliestMonth(product.release);
      if (lower) assert(from>=lower,`${product.id}: game supply precedes recorded release`);
      if (product.gameAvailability.through) assert(monthPattern.test(product.gameAvailability.through) && product.gameAvailability.through>=from,`${product.id}: invalid retirement window`);
      if (product.release.status!=='verified') warnings.push({productId:product.id,kind:'physical_release_not_verified',supplyMonth:from});
      if (product.category==='gpu') {
        assert(byBrand.get(product.specs.graphicsPlatformBrandId)?.roles.includes('graphics_platform'),`${product.id}: graphics platform`);
        assert(product.specs.coreSeries && product.specs.vramGB>0,`${product.id}: GPU identity`);
        assert(product.brandId!=='intek',`${product.id}: Intel Arc outside phase`);
      }
      const knownBounds = {kioxera:'2019-10',zhitide:'2020-09',solidim:'2021-12',trixy:'2024-03'};
      if (knownBounds[product.brandId]) assert(from>=knownBounds[product.brandId],`${product.id}: later brand used before date guard`);
      if (['ram','motherboard'].includes(product.category)) assert(product.specs.memoryType!=='DDR5',`${product.id}: DDR5 outside phase`);
      assert(!JSON.stringify(product.specs).includes('LGA1700'),`${product.id}: LGA1700 outside phase`);
      counts[product.category]++;
    }
    for (const coverage of doc.brandCoverage) {
      assert(byBrand.has(coverage.brandId),`${file}: unknown coverage brand`);
      assert(Array.isArray(coverage.roles) && coverage.note,`${file}: coverage explanation`);
      for (const id of coverage.productIds) assert(local.has(id),`${file}: coverage points outside file: ${id}`);
      checkSources(coverage.sourceIds,`${coverage.brandId} coverage`);
      covered.add(coverage.brandId);
    }
    const eventIds = new Set();
    for (const event of doc.events) {
      assert(!eventIds.has(event.id),`${file}: duplicate event id`);
      eventIds.add(event.id);
      assert(monthPattern.test(event.month) && event.month>='2016-01' && event.month<='2020-12',`${file}: event month`);
      for (const id of event.productIds) assert(local.has(id),`${file}: unknown event product ${id}`);
      checkSources(event.sourceIds,event.id);
      events.push({...event,categoryFile:file});
    }
    for (const exclusion of doc.exclusions) {
      assert(byBrand.has(exclusion.brandId),`${file}: excluded unknown brand`);
      assert(exclusion.reason,`${file}: exclusion reason`);
      checkSources(exclusion.sourceIds,`${exclusion.brandId} exclusion`);
    }
    reports.push({file,products:doc.products.length,sources:doc.sources.length,coverage:doc.brandCoverage.length,gaps:doc.gaps.length});
  }

  // The full registry is covered even when its entity is upstream or arrives after 2020.
  const missing = brands.filter(b=>!covered.has(b.id)).map(b=>b.id);
  assert.deepEqual(missing,[],`Registry brands have no first-phase disposition: ${missing.join(', ')}`);
  const system = read('design/supplier-system.json');
  assert.equal(system.channels[0].minimumUnitsPerLine,1,'Workshop single-unit procurement');
  assert.equal(system.fulfillment.realTimeWaitRequired,false,'No forced wall-clock wait');
  assert.equal(system.events.stockRefreshesOnLogin,false,'No login stock exploit');
  assert.equal(system.events.offlineCrossCalendar,false,'Offline calendar must not advance');
  assert.equal(system.fulfillment.autoSubstitute,false,'Design revisions require an explicit substitution');
  assert.equal(read('design/components.json').parts.length,32,'Full research must not expand Demo');
  const report = {status:'passed',phase:system.phase,registryEntries:brands.length,registryCovered:covered.size,totalProducts:allProducts.size,categoryCounts:counts,files:reports,sourceRecords:reports.reduce((n,r)=>n+r.sources,0),events:events.length,physicalDatesNotVerified:warnings.length,warnings};
  fs.mkdirSync(path.join(root,'.local'),{recursive:true});
  fs.writeFileSync(path.join(root,'.local/supplier-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,warnings:undefined},null,2));
  return report;
}
if (require.main===module) run();
module.exports = {run,earliestMonth};

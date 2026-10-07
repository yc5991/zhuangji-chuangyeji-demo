const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));
const catalog = read('components.json');
const brandData = read('brands.json');
const balance = read('balance.json');
const workbench = read('workbench.json');
const byId = new Map(catalog.parts.map(p => [p.id, p]));
const round = value => Math.round(value * 100) / 100;
const get = id => {
  assert(byId.has(id), `Unknown component: ${id}`);
  return byId.get(id);
};

// Expand repeated RAM sticks and disks so count, cost and power are evaluated per unit.
const expand = entries => entries.flatMap(e => {
  assert(Number.isInteger(e.quantity) && e.quantity > 0, 'Component quantity must be a positive integer.');
  return Array.from({ length: e.quantity }, () => get(e.id));
});
function memoryScore(gb, use) {
  const curve = balance.memoryCurve;
  if (gb <= curve[0].gb) return curve[0][use] * gb / curve[0].gb;
  for (let i = 1; i < curve.length; i++) {
    if (gb <= curve[i].gb) {
      const left = curve[i - 1], right = curve[i];
      return left[use] + (right[use] - left[use]) * (gb - left.gb) / (right.gb - left.gb);
    }
  }
  return curve.at(-1)[use];
}

// Matching consumes one physical plug for each requirement; CPU and GPU roles cannot interchange.
function connectorsMatch(requiredPins, plugs, role) {
  const pool = plugs.filter(p => p.role === role);
  function match(index, used) {
    if (index === requiredPins.length) return true;
    return pool.some((plug, i) => !used.has(i) && plug.supportedPins.includes(requiredPins[index]) && match(index + 1, new Set([...used, i])));
  }
  return match(0, new Set());
}

// This numerical prototype checks catalog compatibility, not the unfinished workbench collision geometry.
function evaluate(plan, date = '2016-06-30', demand = {}) {
  const cpu = get(plan.cpu), board = get(plan.motherboard), gpu = plan.gpu ? get(plan.gpu) : null;
  const psu = get(plan.psu), cooler = get(plan.cooler), chassis = get(plan.case);
  const ram = expand(plan.ram), disks = expand(plan.storage);
  const all = [cpu, board, ...(gpu ? [gpu] : []), psu, cooler, chassis, ...ram, ...disks];
  const blocked = [], warnings = [];
  const block = code => { if (!blocked.includes(code)) blocked.push(code); };
  for (const part of all) if (part.availability.gameDate > date) block('NOT_RELEASED');
  if (!board.game.supportedCpuIds.includes(cpu.id) || board.game.platform !== cpu.game.platform) block('CPU_PLATFORM');
  if (ram.some(p => p.game.ramType !== board.game.ramType)) block('RAM_TYPE');
  if (ram.length > board.game.ramSlots) block('RAM_SLOTS');
  const ramGB = ram.reduce((n, p) => n + p.game.capacityGB, 0);
  if (ramGB === 0 || ramGB > board.game.maxRamGB) block('RAM_CAPACITY');
  if (!chassis.game.supportedForms.includes(board.game.formFactor)) block('BOARD_FORM');
  if (!cooler.game.supportedPlatforms.includes(cpu.game.platform)) block('COOLER_MOUNT');
  if (cooler.game.dimensionsMm.height > chassis.game.coolerMaxHeightMm) block('COOLER_HEIGHT');
  if (psu.game.dimensionsMm.depth > chassis.game.psuMaxDepthMm) block('PSU_DEPTH');
  const cageRemoved = !!plan.removeHddCage;
  if (cageRemoved && !chassis.game.removableHddCage) block('CAGE_NOT_REMOVABLE');
  const gpuMax = cageRemoved ? chassis.game.gpuMaxLengthWithoutCageMm : chassis.game.gpuMaxLengthMm;
  if (gpu && gpu.game.dimensionsMm.length > gpuMax) block('GPU_LENGTH');
  if (!gpu && !(cpu.game.integratedGraphicsScore !== null && board.game.displayOutput)) block('NO_DISPLAY');
  if (!connectorsMatch(gpu?.game.requiredGpuPowerPins || [], psu.game.gpuConnectors, 'GPU_POWER')) block('GPU_POWER_CONNECTORS');
  if (!connectorsMatch([board.game.cpuPowerPins], psu.game.cpuPowerConnectors, 'CPU_POWER')) block('CPU_POWER_CONNECTORS');
  for (const type of ['2.5-inch', '3.5-inch']) {
    const count = disks.filter(p => p.game.bayType === type).length;
    const max = cageRemoved && type === '3.5-inch' ? 0 : chassis.game.storageBays[type];
    if (count > max) block('STORAGE_BAYS');
  }
  if (disks.length > board.game.sataPorts || disks.some(p => p.game.interface !== 'SATA')) block('STORAGE_INTERFACE');
  if (disks.length + 1 > psu.game.sataPowerConnectors) block('SATA_POWER_CONNECTORS');
  const system = get(plan.systemDrive), work = get(plan.workDrive);
  if (!disks.some(p => p.id === system.id) || !disks.some(p => p.id === work.id)) block('DRIVE_SELECTION');
  const fanCount = plan.fanCount ?? chassis.game.defaultFans;
  if (!Number.isInteger(fanCount) || fanCount < 1 || fanCount > chassis.game.maxFans || fanCount > chassis.game.includedFanHub.outputs) block('FAN_SLOTS');
  const profile = balance.fanProfiles[plan.fanProfile || 'balanced'];
  assert(profile, 'Unknown fan profile.');
  const load = cpu.game.designLoadW + (gpu?.game.designLoadW || 0) + board.game.designLoadW +
    [...ram, ...disks].reduce((n, p) => n + p.game.designLoadW, 0) + fanCount * balance.fanLoadW + chassis.game.includedFanHub.designLoadW;
  if (load > psu.game.ratedOutputW) block('POWER_OVERLOAD');
  const headroom = (psu.game.ratedOutputW - load) / psu.game.ratedOutputW;
  if (load <= psu.game.ratedOutputW && headroom < balance.powerHeadroomWarningBelow) warnings.push('POWER_HEADROOM');
  const cpuCooling = cooler.game.coolingUnits * profile.cooling;
  const caseCooling = (chassis.game.caseCoolingUnits + Math.max(0, fanCount - chassis.game.defaultFans) * balance.additionalFanCoolingUnits +
    (cageRemoved ? chassis.game.cageRemovalCoolingBonusUnits || 0 : 0)) * profile.cooling;
  const caseHeat = cpu.game.heatUnits + (gpu?.game.heatUnits || 0) + balance.thermal.mainboardHeatUnits;
  const coolingRatio = Math.min(1, cpuCooling / cpu.game.heatUnits, caseCooling / caseHeat);
  const thermalStable = coolingRatio >= balance.thermal.stabilityRequiresCoolingRatio;
  if (!thermalStable) warnings.push('THERMAL_TUNING_REQUIRED');
  const throttle = Math.max(balance.thermal.throttleFloor, coolingRatio);
  const vram = gpu ? gpu.game.vramGB : balance.integratedVramBudgetGB;
  const vramFit = Math.min(1, vram / (demand.vramGB || balance.defaultRequiredVramGB));
  const graphics = (gpu ? gpu.game.graphicsScore : cpu.game.integratedGraphicsScore || 0) * vramFit * throttle;
  const creation = (gpu ? gpu.game.creationScore : cpu.game.integratedCreationScore || 0) * vramFit * throttle;
  const workCapacityFit = Math.min(1, work.game.capacityGB / (demand.workCapacityGB || balance.defaultWorkCapacityGB)) * 100;
  const workDrive = balance.workDriveWeights.response * work.game.responseScore + balance.workDriveWeights.capacity * workCapacityFit;
  const w = balance.weights;
  const scores = {
    office: w.office.singleThread * cpu.game.singleThreadScore * throttle + w.office.memory * memoryScore(ramGB, 'office') + w.office.response * system.game.responseScore,
    gaming: w.gaming.singleThread * cpu.game.singleThreadScore * throttle + w.gaming.graphics * graphics + w.gaming.memory * memoryScore(ramGB, 'gaming') + w.gaming.response * system.game.responseScore,
    creation: w.creation.multiThread * cpu.game.multiThreadScore * throttle + w.creation.creationAcceleration * creation + w.creation.memory * memoryScore(ramGB, 'creation') + w.creation.workDrive * workDrive
  };
  const noise = (cooler.game.noiseBurden + (gpu?.game.noiseBurden || 0) + fanCount * balance.fanNoiseBurden) * profile.noise +
    psu.game.noiseBurden + disks.reduce((n, p) => n + p.game.noiseBurden, 0);
  const partsCost = all.reduce((n, p) => n + p.game.basePriceCoins, 0) + Math.max(0, fanCount - chassis.game.defaultFans) * balance.additionalFanCostCoins;
  const totalDirectCost = partsCost + (plan.directCostCoins || 0);
  const noiseBurden = round(noise * chassis.game.noiseMultiplier);
  const finalScores = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, round(Math.max(0, Math.min(100, v)))]));
  const deliveryIssues = [];
  if (!thermalStable) deliveryIssues.push('TEST_UNSTABLE');
  if (demand.minimumRamGB && ramGB < demand.minimumRamGB) deliveryIssues.push('CUSTOMER_RAM');
  if (demand.minimumStorageGB && disks.reduce((n,p)=>n+p.game.capacityGB,0) < demand.minimumStorageGB) deliveryIssues.push('CUSTOMER_STORAGE');
  if (demand.requiredDiscreteGpu && !gpu) deliveryIssues.push('CUSTOMER_GPU');
  if (demand.maximumNoiseBurden !== undefined && noiseBurden > demand.maximumNoiseBurden) deliveryIssues.push('CUSTOMER_NOISE');
  for (const [use, minimum] of Object.entries(demand.minimumScores || {})) {
    assert(Object.hasOwn(finalScores,use), 'Unknown customer score requirement.');
    if (finalScores[use] < minimum) deliveryIssues.push(`CUSTOMER_SCORE_${use.toUpperCase()}`);
  }
  return {blocked,warnings,deliveryIssues,passesNumericalDelivery:blocked.length === 0 && deliveryIssues.length === 0,
    thermalStable,partsCost,totalDirectCost,ramGB,designLoadW:load,powerHeadroom:round(headroom),noiseBurden,scores:finalScores,
    contributionRange:plan.budgetCoins?.map(price => price - totalDirectCost),geometryStatus:'not_evaluated'};
}

function run() {
  // Validate fixed scope, foreign keys and the weights before inspecting any balance examples.
  assert.equal(catalog.parts.length, 32);
  assert.equal(byId.size, 32, 'Duplicate component ID.');
  assert.equal(new Set(brandData.brands.map(b=>b.id)).size,brandData.brands.length,'Duplicate brand ID.');
  assert.equal(brandData.brands.filter(b=>b.catalogParticipation==='demo_selected').length,12);
  for (const brand of brandData.brands) {
    if (brand.parentId) assert(brandData.brands.some(b=>b.id===brand.parentId),'Unknown parent brand.');
    if (brand.catalogParticipation==='full_game_placeholder') assert.equal(brand.demoRoles.length,0,'A placeholder has Demo supply roles.');
  }
  assert(brandData.brands.find(b=>b.id==='asux').roles.includes('gpu_board'));
  assert(brandData.brands.find(b=>b.id==='misi').roles.includes('motherboard'));
  for (const id of ['gigabite','colorfull','maxshine']) assert(brandData.brands.some(b=>b.id===id && b.catalogParticipation==='full_game_placeholder'));
  const productSeries = read('product-series.json').series;
  assert.equal(new Set(productSeries.map(s=>s.id)).size,productSeries.length,'Duplicate product series ID.');
  const categoryCounts = {cpu:4,motherboard:3,gpu:8,ram:4,storage:4,psu:3,cooler:3,case:3};
  for (const [category, count] of Object.entries(categoryCounts)) assert.equal(catalog.parts.filter(p => p.category === category).length, count);
  assert.equal(catalog.parts.filter(p => p.availability.gameDate === '2016-01-01').length, 28);
  for (const p of catalog.parts) {
    assert(brandData.brands.some(b => b.id === p.brandId), 'Unknown brand.');
    assert(productSeries.some(s=>s.id===p.seriesId && s.brandId===p.brandId),'Series belongs to another supplier.');
    assert.equal(p.availability.variantSupplyInference.status,'accepted_game_assumption');
    if (p.category === 'gpu') assert(brandData.brands.some(b => b.id === p.game.chipBrandId && b.roles.includes('graphics_platform')));
    assert(Number.isFinite(p.game.basePriceCoins) && p.game.basePriceCoins > 0);
  }
  for (const weights of Object.values(balance.weights)) assert(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0) - 1) < 1e-9);
  const eventDates = workbench.eventDates.map(e => e.date);
  assert.deepEqual(eventDates, [...eventDates].sort());
  for (const event of workbench.eventDates) for (const id of event.parts || []) assert.equal(get(id).availability.gameDate, event.date);
  const reports = balance.recipes.map(plan => {
    const report = evaluate(plan);
    assert.deepEqual(report.blocked, [], `${plan.id} has compatibility blockers.`);
    assert(report.thermalStable, `${plan.id} is thermally unstable in the draft model.`);
    assert(report.passesNumericalDelivery, `${plan.id} fails the numerical delivery gates.`);
    assert.equal(report.partsCost, plan.expectedPartsCost, `${plan.id} cost differs from the agreed arithmetic example.`);
    return {id:plan.id,name:plan.name,...report};
  });

  // Check common player mistakes and meaningful tradeoffs with complete configurations.
  const office = balance.recipes.find(p => p.id === 'office');
  const gaming = balance.recipes.find(p => p.id === 'gaming');
  const premium = balance.recipes.find(p => p.id === 'premium');
  const scenarios = [];
  const expectBlock = (name, plan, code, date) => {
    assert(evaluate(plan, date).blocked.includes(code), `${name}: expected ${code}.`);
    scenarios.push(name);
  };
  expectBlock('DDR3 cannot enter a DDR4 board',{...office,ram:[{id:'ram_ddr3_8',quantity:1}]},'RAM_TYPE');
  expectBlock('FX CPU cannot enter a 1151 board',{...office,cpu:'cpu_fx8350'},'CPU_PLATFORM');
  expectBlock('Three sticks cannot enter a two-slot board',{...office,ram:[{id:'ram_ddr4_4',quantity:3}]},'RAM_SLOTS');
  expectBlock('A 277mm card cannot enter the 250mm case',{...office,gpu:'gpu_970',psu:'psu_450'},'GPU_LENGTH');
  expectBlock('A tall cooler cannot enter the small case',{...office,cooler:'cooler_tower'},'COOLER_HEIGHT');
  expectBlock('Enough watts do not replace a missing GPU plug',{...premium,psu:'psu_350'},'GPU_POWER_CONNECTORS');
  expectBlock('Removing the HDD cage also removes its mounts',{...premium,removeHddCage:true},'STORAGE_BAYS');
  expectBlock('New hardware cannot be bought before its event',{...gaming,gpu:'gpu_1080'},'NOT_RELEASED','2016-05-26');
  assert.deepEqual(evaluate({...gaming,gpu:'gpu_1080'},'2016-05-27').blocked,[]);
  scenarios.push('Hardware unlocks on its release event');
  assert.equal(connectorsMatch([8],[{role:'CPU_POWER',supportedPins:[4,8]}],'GPU_POWER'),false);
  scenarios.push('CPU 8-pin cannot replace GPU 8-pin');
  assert.equal(evaluate({...gaming,psu:'psu_650m'}).scores.gaming,evaluate(gaming).scores.gaming);
  scenarios.push('Higher PSU wattage adds no performance score');
  assert.equal(evaluate({...gaming,storage:[...gaming.storage,{id:'hdd_1000',quantity:1}]}).scores.office,evaluate(gaming).scores.office);
  scenarios.push('Adding a data HDD does not accelerate the system disk');
  const rx4 = {...gaming,gpu:'gpu_rx480_4'}, rx8 = {...gaming,gpu:'gpu_rx480_8'};
  assert.equal(evaluate(rx4).scores.gaming,evaluate(rx8).scores.gaming);
  assert(evaluate(rx8,undefined,{vramGB:6}).scores.gaming > evaluate(rx4,undefined,{vramGB:6}).scores.gaming);
  scenarios.push('Extra VRAM helps tasks that need it, without doubling the base score');
  assert(reports.find(r=>r.id==='quiet_office').noiseBurden < reports.find(r=>r.id==='office').noiseBurden);
  scenarios.push('Quiet office customization lowers noise with the same CPU');
  assert.equal(memoryScore(12,'office'),90);
  scenarios.push('Mixed stick capacities use the memory interpolation rule');
  assert(evaluate(office,undefined,{minimumRamGB:16}).deliveryIssues.includes('CUSTOMER_RAM'));
  scenarios.push('A customer minimum cannot be offset by other scores');
  assert.equal(evaluate({...premium,fanProfile:'quiet'}).passesNumericalDelivery,false);
  scenarios.push('A quiet fan profile still has to pass thermal stability');
  assert.equal(evaluate(balance.recipes.find(p=>p.id==='quiet_office'),undefined,{maximumNoiseBurden:20}).passesNumericalDelivery,true);
  assert(evaluate(office,undefined,{maximumNoiseBurden:20}).deliveryIssues.includes('CUSTOMER_NOISE'));
  scenarios.push('A low-cost CPU can meet a premium quiet requirement');
  const output = {status:'passed',catalogCount:32,openingCount:28,brandRegistryEntries:brandData.brands.length,demoBrands:12,productSeries:productSeries.length,scenarioCount:scenarios.length,scenarios,recipes:reports,
    limits:['Numerical draft only; not a Cocos workbench run.','Full collision geometry and six-month business balance remain unverified.','Exact revision availability is an authorized game assumption, distinct from historical evidence.']};
  fs.mkdirSync(path.join(root,'.local'),{recursive:true});
  fs.writeFileSync(path.join(root,'.local','design-verification.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,scenarioCount:output.scenarioCount,recipes:reports},null,2));
  return output;
}
if (require.main === module) run();
module.exports = {evaluate,memoryScore,connectorsMatch,run};

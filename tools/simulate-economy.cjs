const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));
const config = read('economy-candidate.json');
const recipes = new Map(read('balance.json').recipes.map(p => [p.id, p]));
// Procurement channels live in supplier-system.json so the discount has one source of truth.
const channels = new Map(read('supplier-system.json').channels.map(c => [c.id, c]));
// Customer deposits live with the segments, so a commission's advance has one source of truth.
const customerModel = read('customer-model.json');
const depositFraction = Object.fromEntries(Object.entries(customerModel.segments).map(([id, s]) => [id, s.depositFraction || 0]));
const productSegment = {};
for (const [segId, seg] of Object.entries(customerModel.segments)) for (const p of seg.products) productSegment[p] = segId;

// Each archetype is eligible for exactly one recipe, so orders can be attributed per product.
const { evaluate } = require('./check-design.cjs');
const { evaluateDimensions } = require('./evaluate-product.cjs');
const { satisfies } = require('./check-customers.cjs');
const { archetypesByProduct, appearancePricePremium, acceptanceOf } = require('./price-acceptance.cjs');
// Parts cost by category, so an event that names a category only moves the builds exposed to it.
const partsCatalog = read('components.json');
const byPart = new Map(partsCatalog.parts.map(p => [p.id, p]));
const categoryCost = {};
for (const r of recipes.values()) {
  const per = {};
  const add = (id, q) => { const p = byPart.get(id); per[p.category] = (per[p.category] || 0) + p.game.basePriceCoins * q; };
  for (const e of r.ram) add(e.id, e.quantity);
  for (const e of r.storage) add(e.id, e.quantity);
  for (const key of ['cpu', 'motherboard', 'gpu', 'psu', 'cooler', 'case']) if (r[key]) add(r[key], 1);
  categoryCost[r.id] = per;
}
const reliability = read('reliability-model.json');
// Expected rework per unit, derived from the design-quality signals the balance model already reports.
function failureRateFor(recipe, gradeMultiplier = 1) {
  const report = evaluate(recipe);
  const r = reliability.failureRate;
  let rate = r.base * gradeMultiplier;
  if (!report.thermalStable) rate *= r.conditionMultipliers.thermallyUnstable;
  if (report.powerHeadroom < r.conditionMultipliers.powerHeadroomThreshold) rate *= r.conditionMultipliers.powerHeadroomBelowThreshold;
  if (report.deliveryIssues.includes('TEST_UNSTABLE')) rate *= r.conditionMultipliers.deliveryIssueUnstable;
  return Math.min(r.ceiling, rate);
}
// A tested build catches its failures in the workshop; an untested one ships them.
// Three tiers, not two: below the catch threshold nothing is found, between the two thresholds only
// part is caught, and a full test catches nearly everything.
function escapeRateFor(product) {
  const qc = reliability.qualityControl;
  const hours = product.testStationHours;
  if (hours >= qc.minimalTestingHours) return qc.escapeRateWithMinimalTesting;
  if (hours >= qc.caughtWhenTestHoursAtLeast) return qc.escapeRateWithPartialTesting;
  return qc.escapeRateWithoutTesting;
}

// A model cannot be built before its parts exist, and a part that reaches the market mid-month
// cannot support a full month of production. The second half is what
// workbench.scheduleRules.lateReleaseCannotUseFullMonthCapacity requires.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DEMO_FIRST_MONTH = 1;
function releaseCapacityFactor(productId, month) {
  const recipe = recipes.get(productId);
  if (!recipe) return 1;
  const ids = [];
  for (const key of ['cpu', 'motherboard', 'gpu', 'psu', 'cooler', 'case', 'systemDrive', 'workDrive']) {
    const v = recipe[key];
    if (v) ids.push(typeof v === 'string' ? v : v.id);
  }
  for (const key of ['ram', 'storage']) for (const e of recipe[key] || []) ids.push(e.id);
  let latest = null;
  for (const id of ids) {
    const date = byPart.get(id)?.availability?.gameDate;
    if (date && (!latest || date > latest)) latest = date;
  }
  if (!latest) return 1;
  const [year, mon, day] = latest.split('-').map(Number);
  // Only the demo window is modelled; anything arriving after it never becomes available in six months.
  if (year !== 2016 || mon < DEMO_FIRST_MONTH || mon > 6) return 0;
  if (mon > month) return 0;      // the part is not on the market yet
  if (mon < month) return 1;      // it arrived in an earlier month
  const days = DAYS_IN_MONTH[mon - 1];
  return Math.max(0, (days - day + 1) / days);   // arrives mid-month
}

// A scenario may scope its effect to a month window and to named categories.
function partsCostFor(productId, scenario, month) {
  const base = recipes.get(productId).expectedPartsCost;
  const from = scenario.fromMonth ?? 1, through = scenario.throughMonth ?? 6;
  if (month < from || month > through) return base;
  if (!scenario.categoryMultipliers) return base * (scenario.partsPriceMultiplier ?? 1);
  const per = categoryCost[productId];
  let total = base;
  for (const [cat, mult] of Object.entries(scenario.categoryMultipliers)) {
    const exposed = per[cat] || 0;
    total += exposed * (mult - 1);
  }
  return total;
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Fit: how well the built machine scores against what this archetype expects.
function fitOf(productId, recipe) {
  const members = archetypesByProduct[productId] || [];
  if (!members.length) return 1;
  const report = evaluate(recipe);
  const weight = members.reduce((n, a) => n + a.weight, 0);
  return members.reduce((n, a) => {
    // Scoring high is not enough: a machine that fails an archetype's hard gates never reaches
    // that customer, so its weight contributes nothing.
    if (!satisfies(recipe, a.requirements)) return n;
    return n + a.weight * clamp(report.scores[a.fitUseCase] / a.expectedScore, 0, 1);
  }, 0) / weight;
}

// Price acceptance lives in price-acceptance.cjs so the customer checks can share it.
const round = n => Math.round(n * 100) / 100;

// Scenario inputs are proposed business parameters, separate from component reference data.
function simulate(routeId, scenarioId, difficulty = 'normal', overrides = {}) {
  const opening = { ...config.opening[difficulty], ...(overrides.opening || {}) };
  const employee = { ...config.employee, ...(overrides.employee || {}) };
  // A worker's grade moves how long assembly takes and how often it needs rework.
  const gradeAssembly = employee.assemblyHourMultiplier ?? 1;
  const gradeFailure = employee.failureRateMultiplier ?? 1;
  const products = overrides.products || config.products;
  const route = { ...config.routes[routeId], ...overrides };
  // A caller may supply a synthetic scenario, which is how the fifteen-year pacing run works.
  const scenario = overrides.scenario || config.scenarios[scenarioId];
  const channel = channels.get(route.partsChannel);
  assert(channel, `Route ${routeId} must name a procurement channel.`);
  const channelFactor = (overrides.channelFactor ?? channel.nominalUnitPriceFactor);
  const termMonths = channel.paymentTermMonths || 0;
  const creditLimit = opening.creditLimitCoins || 0;
  const gatedAtStart = !opening.startingRoutes.includes(routeId);
  let cash = opening.cash, employees = opening.employees, benches = opening.benches;
  let monthlyUtilities = opening.utilities, standardMultiplier = 1, commissionMultiplier = 1, consumablesReduction = 0;
  let standardConsumablesReduction = 0;
  let totalSales = 0, totalRevenue = 0, totalCogs = 0, totalFixed = 0, totalInvestment = 0, totalDevelopment = 0;
  let totalDeposits = 0, totalPayablesPaid = 0, totalRework = 0;
  let bankrupt = false, bankruptMonth = null;
  // Reputation multiplies how many of the reachable orders actually convert.
  let reputation = customerModel.reputation.initial;
  // Parts bought on account are owed, not paid. They settle at the month end when the term expires.
  let payables = [];
  const developed = new Set(), stock = Object.fromEntries(Object.keys(products).map(id => [id, []]));
  const months = [];

  for (let index = 0; index < 6 && !bankrupt; index++) {
    const month = index + 1, startCash = cash;
    const buys = route.investments.filter(p => p.month === month);
    const hires = route.hires.filter(m => m === month).length;
    const prospectiveFixed = opening.rent + monthlyUtilities + (employees + hires) * employee.monthlySalary +
      buys.reduce((n, p) => n + (config.investments[p.id].additionalMonthlyUtilities || 0), 0);
    const outlay = buys.reduce((n, p) => n + config.investments[p.id].cost, 0) + hires * employee.recruitmentCost;
    const notices = [];

    // Keep this month's fixed costs available before irreversible procurement or expansion.
    if (cash >= outlay + prospectiveFixed) {
      // Benches bought this month count for equipment bought this month, so the order the route
      // happens to list them in cannot change whether the purchase succeeds.
      const ordered = [...buys].sort((a, b) =>
        (config.investments[b.id].addedBenches || 0) - (config.investments[a.id].addedBenches || 0));
      for (const purchase of ordered) {
        const investment = config.investments[purchase.id];
        assert(!investment.requiresBenches || benches >= investment.requiresBenches, 'Equipment needs the proposed bench count.');
        cash -= investment.cost;
        totalInvestment += investment.cost;
        benches += investment.addedBenches || 0;
        monthlyUtilities += investment.additionalMonthlyUtilities || 0;
        standardMultiplier = investment.standardAssemblyMultiplier || standardMultiplier;
        commissionMultiplier = investment.commissionAssemblyMultiplier || commissionMultiplier;
        consumablesReduction = investment.commissionConsumablesReduction || consumablesReduction;
        standardConsumablesReduction = investment.standardConsumablesReduction || standardConsumablesReduction;
      }
      employees += hires;
      cash -= hires * employee.recruitmentCost;
      totalInvestment += hires * employee.recruitmentCost;
    } else if (outlay) notices.push('EXPANSION_UNAFFORDABLE');

    const fixed = opening.rent + monthlyUtilities + employees * employee.monthlySalary;
    const limits = { labor: opening.ownerHours + employees * employee.monthlyLaborHours,
      owner: opening.ownerHours, bench: benches * config.stationMonthlyHours,
      test: opening.testStations * config.stationMonthlyHours };
    const used = { labor: 0, owner: 0, bench: 0, test: 0 };
    // Appearance depends only on the product definition, so it is worked out once a month.
    const appearance = {};
    for (const id of Object.keys(products)) {
      // An incompatible build cannot be assembled at all, whatever the customer wants.
      const blocked = evaluate(recipes.get(id)).blocked;
      if (blocked.length) {
        appearance[id] = { blocked: true, score: 0, premium: 0, cost: 0, hours: 0, price: 0 };
        if (!notices.includes('BUILD_BLOCKED:' + id)) notices.push('BUILD_BLOCKED:' + id);
        continue;
      }
      const report = evaluateDimensions(recipes.get(id), {
        targetUseCase: products[id].targetUseCase || 'office',
        finishLevelId: products[id].finishLevelId || 'standard',
        caseOptions: products[id].caseOptions || {},
      });
      const premium = appearancePricePremium(report.scores.appearance);
      appearance[id] = {
        score: report.scores.appearance,
        premium,
        // Appearance is not free: the finish and the chosen case options both cost money and time.
        cost: report.finishLevel.additionalConsumablesCoins + report.caseOptionCost,
        hours: report.finishLevel.additionalLaborHours,
        // The customer pays what the finish is worth, so the asking price carries the premium.
        price: Math.round(products[id].salePrice * (1 + premium)),
      };
    }
    // Reachable orders per product, then reduced by fit, price acceptance and reputation.
    const demand = {}, orders = {};
    for (const id of Object.keys(products)) {
      // A blocked build reaches no customer, so no order exists for it at all.
      if (appearance[id]?.blocked) { demand[id] = 0; orders[id] = 0; continue; }
      const inWindow = month >= (scenario.fromMonth ?? 1) && month <= (scenario.throughMonth ?? 6);
      const caps = overrides.demandCaps || config.companyDemandCaps;
      const pool = Math.round(caps[id][index] * (inWindow ? scenario.demandMultiplier : 1));
      const fit = fitOf(id, recipes.get(id));
      const acceptance = acceptanceOf(id, appearance[id].price, appearance[id].premium);
      // Reputation above one may grow the reachable pool. The default keeps it a hard ceiling, so
      // a good reputation is a buffer rather than a bonus.
      // Decision 4: a reputation above one grows the reachable pool. The game already did this; the
  // model kept it a hard ceiling, so the two disagreed. The rule that mixed must rank highest was
  // deleted from the specification, so growth no longer breaks anything.
  const grows = overrides.reputationGrowsPool || 'all';
      const growsThis = grows === 'all' || (grows === 'bespoke' && productSegment[id] === 'bespoke');
      // Only a reputation above one can grow the pool; below one it always shrinks demand.
      const scale = growsThis ? Math.max(1, reputation) : 1;
      const reachable = Math.round(pool * scale);
      orders[id] = reachable;
      demand[id] = Math.min(reachable, Math.floor(reachable * fit * acceptance * Math.min(1, reputation)));
    }
    const sold = {}, built = {};
    let revenue = 0, cogs = 0, procurement = 0, development = 0;
    let cashProcurement = 0, cashFromSales = 0, depositsTaken = 0, payablesPaid = 0, reworkTotal = 0;

    // Finished stock is sold first, preserving its historical purchase cost through price changes.
    for (const [id, lots] of Object.entries(stock)) {
      while (lots.length && demand[id] > 0) {
        const cost = lots.shift();
        const price = Math.round(appearance[id].price * (scenario.priceIndex ?? 1));
        cash += price; cashFromSales += price; revenue += price; cogs += cost; demand[id]--;
        sold[id] = (sold[id] || 0) + 1;
      }
    }

    for (const [id, target] of Object.entries(route.monthlyProductionTargets[index])) {
      const product = products[id], recipe = recipes.get(id);
      assert(recipe, 'Scenario product must use an existing recipe.');
      // The plan cannot be carried out on a machine that cannot be assembled.
      if (appearance[id]?.blocked) continue;
      // A commission is built to order; a standard model is built to the route's plan, which is
      // what makes the mass route build more than it can sell.
      const want = product.kind === 'commission' ? Math.min(target, demand[id]) : target;
      // A model whose parts arrive mid-month can only use the rest of that month.
      const release = releaseCapacityFactor(id, month);
      const count = release >= 1 ? want : Math.ceil(want * release);
      if (count === 0) continue;
      if (product.kind === 'standard' && !developed.has(id)) {
        const need = { labor: product.developmentLaborHours, owner: product.developmentLaborHours,
          bench: product.developmentBenchHours, test: product.developmentTestHours };
        if (cash < fixed + product.developmentCost || Object.keys(need).some(k => used[k] + need[k] > limits[k])) {
          notices.push(`DEVELOPMENT_BLOCKED:${id}`); continue;
        }
        for (const k of Object.keys(need)) used[k] += need[k];
        cash -= product.developmentCost; development += product.developmentCost;
        developed.add(id);
      }

      // Process one complete machine at a time: receipt can fund the next unit, not the current one.
      for (let unit = 0; unit < count; unit++) {
        const multiplier = product.kind === 'standard' ? standardMultiplier : commissionMultiplier;
        const assembly = product.assemblyHours * multiplier * gradeAssembly;
        // Rework is charged as expected value: its real cost is the capacity it consumes.
        const failRate = failureRateFor(recipe, gradeFailure);
        const need = { labor: product.designHours + assembly + product.testSetupHours + product.packingHours +
            appearance[id].hours + failRate * reliability.rework.laborHours,
          owner: product.designHours, bench: assembly,
          test: product.testStationHours + failRate * reliability.rework.testStationHours };
        if (Object.keys(need).some(k => used[k] + need[k] > limits[k] + 1e-8)) {
          notices.push(`CAPACITY_LIMIT:${id}`); break;
        }
        const cost = round(partsCostFor(id, scenario, month) * channelFactor *
          opening.supplierTermsFactor + recipe.directCostCoins + appearance[id].cost -
          (product.kind === 'commission' ? consumablesReduction : standardConsumablesReduction));
        // A commissioned build is paid in advance, so the deposit arrives before the parts are bought.
        // The era price index moves the asking price with the market, not only the parts bill.
        const price = Math.round(appearance[id].price * (scenario.priceIndex ?? 1));
        const deposit = product.kind === 'commission'
          ? Math.round(price * (depositFraction[productSegment[id]] || 0)) : 0;
        if (deposit) { cash += deposit; depositsTaken += deposit; totalDeposits += deposit; }
        // Buy on account while credit remains; otherwise the parts must be paid for in cash.
        const outstanding = payables.reduce((n, p) => n + p.amount, 0);
        if (termMonths > 0 && outstanding + cost <= creditLimit) {
          payables.push({ amount: cost, dueMonth: month + termMonths });
        } else {
          // A commissioned build is self-funding: the deposit is already in cash and the balance
          // arrives on delivery, so only the shortfall has to come out of the workshop's own money.
          const receivable = product.kind === 'commission' ? price - deposit : 0;
          if (cash + receivable < fixed + cost) {
            // The order is not taken after all, so the advance goes back to the customer.
            if (deposit) { cash -= deposit; depositsTaken -= deposit; totalDeposits -= deposit; }
            notices.push(`PROCUREMENT_CASH_LIMIT:${id}`); break;
          }
          cash -= cost; cashProcurement += cost;
        }
        for (const k of Object.keys(need)) used[k] += need[k];
        // Consumables and any replaced part are real money; an escaped defect refunds the sale.
        const reworkCost = failRate * (reliability.rework.consumablesCoins +
          reliability.rework.partReplacementChance * recipe.expectedPartsCost);
        // An escaped defect refunds the sale and pays the logistics of getting it back.
        const escorts = escapeRateFor(product);
        const escapeCost = failRate * escorts *
          (price * reliability.arrivalDefect.refundFraction + reliability.arrivalDefect.logisticsCoins);
        cash -= reworkCost + escapeCost;
        reworkTotal += reworkCost + escapeCost;
        procurement += cost; built[id] = (built[id] || 0) + 1;
        if (demand[id] > 0) {
          const balance = price - deposit;
          cash += balance; cashFromSales += balance; revenue += price; cogs += cost; demand[id]--;
          sold[id] = (sold[id] || 0) + 1;
        } else stock[id].push(cost);
      }
    }

    // Settle everything whose term has expired, then pay the month's own fixed costs.
    const due = payables.filter(p => p.dueMonth <= month);
    if (due.length) {
      payablesPaid = due.reduce((n, p) => n + p.amount, 0);
      totalPayablesPaid += payablesPaid;
      cash -= payablesPaid;
      payables = payables.filter(p => p.dueMonth > month);
    }
    cash -= fixed;
    totalRevenue += revenue; totalCogs += cogs; totalFixed += fixed; totalDevelopment += development;
    totalRework += reworkTotal;
    const salesCount = Object.values(sold).reduce((n, p) => n + p, 0);
    totalSales += salesCount;
    const stockCost = round(Object.values(stock).flat().reduce((n, p) => n + p, 0));
    const monthProfit = round(revenue - cogs - fixed - development - reworkTotal);
    // Reputation tracks whether the workshop delivered what it committed to. The reachable pool is
    // not a backlog: a boutique shop is capacity bound and a mass line is demand bound, so leaving
    // part of the pool unserved is normal. Only a broken commitment costs reputation.
    const orderedTotal = Object.values(orders).reduce((n, v) => n + v, 0);
    const servedTotal = Object.values(sold).reduce((n, v) => n + v, 0);
    const rep = customerModel.reputation;
    const reputationBefore = reputation;
    const missedCommitment = notices.some(n => n.startsWith('CAPACITY_LIMIT') || n.startsWith('PROCUREMENT_CASH_LIMIT') || n.startsWith('DEVELOPMENT_BLOCKED'));
    // Three outcomes, not two: a month that delivers some of what it committed to is late rather
    // than missed, and late costs less reputation than letting a customer down completely.
    const lateCommitment = missedCommitment && servedTotal > 0;
    const reputationDelta = lateCommitment ? rep.lateMeetingRequirements
      : missedCommitment ? rep.deliveredMissingRequirement : rep.onTimeMeetingRequirements;
    reputation = clamp(reputation + reputationDelta, rep.floor, rep.ceiling);
    const outstandingNow = round(payables.reduce((n, p) => n + p.amount, 0));
    months.push({month,startCash:round(startCash),endCash:round(cash),sold,built,revenue:round(revenue),
      costOfGoodsSold:round(cogs),procurement:round(procurement),fixedCost:fixed,developmentCost:development,
      depositsTaken:round(depositsTaken),payablesPaid:round(payablesPaid),payablesOutstanding:outstandingNow,
      reworkCost:round(reworkTotal),
      orders,servedTotal,orderedTotal,reputationBefore:round(reputationBefore),reputationAfter:round(reputation),
      operatingProfit:monthProfit,inventoryCost:stockCost,inventoryUnits:Object.values(stock).reduce((n,p)=>n+p.length,0),
      capacityUsed:Object.fromEntries(Object.entries(used).map(([k,v])=>[k,round(v)])),capacityAvailable:limits,
      notices:[...new Set(notices)]});
    assert(Math.abs(cash - (startCash + cashFromSales + depositsTaken - cashProcurement - payablesPaid - reworkTotal - fixed - development -
      (totalInvestment - months.slice(0,-1).reduce((n,m)=>n+(m.investmentPaid||0),0)))) < 0.02, 'Cash ledger does not reconcile.');
    months.at(-1).investmentPaid = totalInvestment - months.slice(0,-1).reduce((n,m)=>n+m.investmentPaid,0);
    for (const k of Object.keys(used)) assert(used[k] <= limits[k] + 1e-8, 'Capacity exceeded.');
    // A company that cannot cover its own month is insolvent; the run stops here.
    if (cash < 0) { bankrupt = true; bankruptMonth = month; }
  }
  const inventoryCost = round(Object.values(stock).flat().reduce((n,p)=>n+p,0));
  const payablesOutstanding = round(payables.reduce((n, p) => n + p.amount, 0));
  const operatingProfit = round(totalRevenue - totalCogs - totalFixed - totalDevelopment - totalRework);
  // Parts bought on account are a liability, so they are added back before checking the ledger.
  assert(Math.abs(cash + inventoryCost - payablesOutstanding - opening.cash - (operatingProfit - totalInvestment)) < 0.02,
    'Operating profit, inventory, payables and cash do not reconcile.');
  if (bankrupt) assert(cash < 0, 'Bankruptcy must coincide with a negative cash balance.');
  return {route:routeId,scenario:scenarioId,difficulty,partsChannel:channel.id,partsChannelFactor:channelFactor,
    paymentTermMonths:termMonths,creditLimitCoins:creditLimit,gatedAtStart,reputation:round(reputation),
    totalDeposits:round(totalDeposits),totalPayablesPaid:round(totalPayablesPaid),payablesOutstanding,
    totalReworkCost:round(totalRework),
    bankrupt,bankruptMonth,totalSales,totalRevenue,totalCostOfGoodsSold:round(totalCogs),
    totalFixedCost:totalFixed,totalDevelopmentCost:totalDevelopment,totalInvestment,
    operatingProfit,endCash:round(cash),inventoryCost,cashAndInventoryGain:round(cash+inventoryCost-opening.cash),months};
}

// Every route runs under each confirmed difficulty and each stress scenario; expansion dates stay as proposed.
function runAll() {
const results = [];
for (const difficulty of Object.keys(config.opening))
  for (const scenario of Object.keys(config.scenarios))
    for (const route of Object.keys(config.routes)) results.push(simulate(route,scenario,difficulty));
const report = {status:'unconfirmed_candidate_scenarios',provenance:config.provenance,
  limitations:[
    'Capacity checks use monthly totals and owner design hours, not a dependency-aware event schedule.',
    'The owner performs design; employees and owner share other work. Only owner design availability is separately checked.',
    'Delivery costs are in direct costs. Lead times and returns are not simulated. Release-day capacity, component lots, quality and reputation are simulated; an earlier version of this list predated them.',
    'Stock retains historical cost. No markdown, resale, demand adaptation, depreciation or equipment residual value is modeled.',
    'Existing recipe variants are sold at assumed prices and all valid commissioned orders pay on completion.',
    'Demand is an assumed company sales ceiling, not a validated market forecast. First prototypes are sold, not discarded.'
  ],results};
fs.writeFileSync(path.join(root,'design','economy-review-results.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(results.map(({route,scenario,totalSales,operatingProfit,totalInvestment,endCash,inventoryCost,cashAndInventoryGain,months}) =>
  ({route,scenario,totalSales,operatingProfit,totalInvestment,endCash,inventoryCost,cashAndInventoryGain,
    constrainedMonths:months.filter(m=>m.notices.length).map(m=>({month:m.month,notices:m.notices}))})),null,2));
return results;
}
if (require.main === module) runAll();
module.exports = { simulate, runAll, config, channels, recipes, failureRateFor, partsCostFor,
  releaseCapacityFactor, acceptanceOf };

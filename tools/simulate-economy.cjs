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
const archetypesByProduct = {};
for (const a of customerModel.archetypes) (archetypesByProduct[a.referenceRecipe] ||= []).push(a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Fit: how well the built machine scores against what this archetype expects.
function fitOf(productId, recipe) {
  const members = archetypesByProduct[productId] || [];
  if (!members.length) return 1;
  const report = evaluate(recipe);
  const weight = members.reduce((n, a) => n + a.weight, 0);
  return members.reduce((n, a) => n + a.weight * clamp(report.scores[a.fitUseCase] / a.expectedScore, 0, 1), 0) / weight;
}

// Price acceptance: a segment slope either side of the archetype's market reference price.
function acceptanceOf(productId, price) {
  const members = archetypesByProduct[productId] || [];
  if (!members.length) return 1;
  const weight = members.reduce((n, a) => n + a.weight, 0);
  return members.reduce((n, a) => {
    const reference = (a.budgetCoins[0] + a.budgetCoins[1]) / 2;
    const ratio = price / reference;
    const above = customerModel.priceAcceptance.aboveSlopeBySegment[a.segment];
    const p = ratio <= 1
      ? clamp(1 + customerModel.priceAcceptance.belowSlope * (1 - ratio), 1, customerModel.priceAcceptance.ceiling)
      : clamp(1 - above * (ratio - 1), customerModel.priceAcceptance.floor, 1);
    return n + a.weight * p;
  }, 0) / weight;
}
const round = n => Math.round(n * 100) / 100;

// Scenario inputs are proposed business parameters, separate from component reference data.
function simulate(routeId, scenarioId, difficulty = 'normal') {
  const opening = config.opening[difficulty];
  const route = config.routes[routeId];
  const scenario = config.scenarios[scenarioId];
  const channel = channels.get(route.partsChannel);
  assert(channel, `Route ${routeId} must name a procurement channel.`);
  const channelFactor = channel.nominalUnitPriceFactor;
  const termMonths = channel.paymentTermMonths || 0;
  const creditLimit = opening.creditLimitCoins || 0;
  const gatedAtStart = !opening.startingRoutes.includes(routeId);
  let cash = opening.cash, employees = opening.employees, benches = opening.benches;
  let monthlyUtilities = opening.utilities, standardMultiplier = 1, commissionMultiplier = 1, consumablesReduction = 0;
  let totalSales = 0, totalRevenue = 0, totalCogs = 0, totalFixed = 0, totalInvestment = 0, totalDevelopment = 0;
  let totalDeposits = 0, totalPayablesPaid = 0;
  let bankrupt = false, bankruptMonth = null;
  // Reputation multiplies how many of the reachable orders actually convert.
  let reputation = customerModel.reputation.initial;
  // Parts bought on account are owed, not paid. They settle at the month end when the term expires.
  let payables = [];
  const developed = new Set(), stock = Object.fromEntries(Object.keys(config.products).map(id => [id, []]));
  const months = [];

  for (let index = 0; index < 6 && !bankrupt; index++) {
    const month = index + 1, startCash = cash;
    const buys = route.investments.filter(p => p.month === month);
    const hires = route.hires.filter(m => m === month).length;
    const prospectiveFixed = opening.rent + monthlyUtilities + (employees + hires) * config.employee.monthlySalary +
      buys.reduce((n, p) => n + (config.investments[p.id].additionalMonthlyUtilities || 0), 0);
    const outlay = buys.reduce((n, p) => n + config.investments[p.id].cost, 0) + hires * config.employee.recruitmentCost;
    const notices = [];

    // Keep this month's fixed costs available before irreversible procurement or expansion.
    if (cash >= outlay + prospectiveFixed) {
      for (const purchase of buys) {
        const investment = config.investments[purchase.id];
        assert(!investment.requiresBenches || benches >= investment.requiresBenches, 'Equipment needs the proposed bench count.');
        cash -= investment.cost;
        totalInvestment += investment.cost;
        benches += investment.addedBenches || 0;
        monthlyUtilities += investment.additionalMonthlyUtilities || 0;
        standardMultiplier = investment.standardAssemblyMultiplier || standardMultiplier;
        commissionMultiplier = investment.commissionAssemblyMultiplier || commissionMultiplier;
        consumablesReduction = investment.commissionConsumablesReduction || consumablesReduction;
      }
      employees += hires;
      cash -= hires * config.employee.recruitmentCost;
      totalInvestment += hires * config.employee.recruitmentCost;
    } else if (outlay) notices.push('EXPANSION_UNAFFORDABLE');

    const fixed = opening.rent + monthlyUtilities + employees * config.employee.monthlySalary;
    const limits = { labor: opening.ownerHours + employees * config.employee.monthlyLaborHours,
      owner: opening.ownerHours, bench: benches * config.stationMonthlyHours,
      test: opening.testStations * config.stationMonthlyHours };
    const used = { labor: 0, owner: 0, bench: 0, test: 0 };
    // Reachable orders per product, then reduced by fit, price acceptance and reputation.
    const demand = {}, orders = {};
    for (const id of Object.keys(config.products)) {
      const pool = Math.round(config.companyDemandCaps[id][index] * scenario.demandMultiplier);
      const fit = fitOf(id, recipes.get(id));
      const acceptance = acceptanceOf(id, config.products[id].salePrice);
      orders[id] = pool;
      demand[id] = Math.min(pool, Math.floor(pool * fit * acceptance * reputation));
    }
    const sold = {}, built = {};
    let revenue = 0, cogs = 0, procurement = 0, development = 0;
    let cashProcurement = 0, cashFromSales = 0, depositsTaken = 0, payablesPaid = 0;

    // Finished stock is sold first, preserving its historical purchase cost through price changes.
    for (const [id, lots] of Object.entries(stock)) {
      while (lots.length && demand[id] > 0) {
        const cost = lots.shift();
        const price = config.products[id].salePrice;
        cash += price; cashFromSales += price; revenue += price; cogs += cost; demand[id]--;
        sold[id] = (sold[id] || 0) + 1;
      }
    }

    for (const [id, target] of Object.entries(route.monthlyProductionTargets[index])) {
      const product = config.products[id], recipe = recipes.get(id);
      assert(recipe, 'Scenario product must use an existing recipe.');
      const count = product.kind === 'commission' ? Math.min(target, demand[id]) : target;
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
        const assembly = product.assemblyHours * multiplier;
        const need = { labor: product.designHours + assembly + product.testSetupHours + product.packingHours,
          owner: product.designHours, bench: assembly, test: product.testStationHours };
        if (Object.keys(need).some(k => used[k] + need[k] > limits[k] + 1e-8)) {
          notices.push(`CAPACITY_LIMIT:${id}`); break;
        }
        const cost = round(recipe.expectedPartsCost * scenario.partsPriceMultiplier * channelFactor *
          opening.supplierTermsFactor + recipe.directCostCoins -
          (product.kind === 'commission' ? consumablesReduction : 0));
        // A commissioned build is paid in advance, so the deposit arrives before the parts are bought.
        const deposit = product.kind === 'commission'
          ? Math.round(product.salePrice * (depositFraction[productSegment[id]] || 0)) : 0;
        if (deposit) { cash += deposit; depositsTaken += deposit; totalDeposits += deposit; }
        // Buy on account while credit remains; otherwise the parts must be paid for in cash.
        const outstanding = payables.reduce((n, p) => n + p.amount, 0);
        if (termMonths > 0 && outstanding + cost <= creditLimit) {
          payables.push({ amount: cost, dueMonth: month + termMonths });
        } else {
          // A commissioned build is self-funding: the deposit is already in cash and the balance
          // arrives on delivery, so only the shortfall has to come out of the workshop's own money.
          const receivable = product.kind === 'commission' ? product.salePrice - deposit : 0;
          if (cash + receivable < fixed + cost) {
            // The order is not taken after all, so the advance goes back to the customer.
            if (deposit) { cash -= deposit; depositsTaken -= deposit; totalDeposits -= deposit; }
            notices.push(`PROCUREMENT_CASH_LIMIT:${id}`); break;
          }
          cash -= cost; cashProcurement += cost;
        }
        procurement += cost; built[id] = (built[id] || 0) + 1;
        if (demand[id] > 0) {
          const balance = product.salePrice - deposit;
          cash += balance; cashFromSales += balance; revenue += product.salePrice; cogs += cost; demand[id]--;
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
    const salesCount = Object.values(sold).reduce((n, p) => n + p, 0);
    totalSales += salesCount;
    const stockCost = round(Object.values(stock).flat().reduce((n, p) => n + p, 0));
    const monthProfit = round(revenue - cogs - fixed - development);
    // Reputation tracks whether the workshop delivered what it committed to. The reachable pool is
    // not a backlog: a boutique shop is capacity bound and a mass line is demand bound, so leaving
    // part of the pool unserved is normal. Only a broken commitment costs reputation.
    const orderedTotal = Object.values(orders).reduce((n, v) => n + v, 0);
    const servedTotal = Object.values(sold).reduce((n, v) => n + v, 0);
    const rep = customerModel.reputation;
    const reputationBefore = reputation;
    const missedCommitment = notices.some(n => n.startsWith('CAPACITY_LIMIT') || n.startsWith('PROCUREMENT_CASH_LIMIT') || n.startsWith('DEVELOPMENT_BLOCKED'));
    reputation = clamp(reputation + (missedCommitment ? rep.deliveredMissingRequirement : rep.onTimeMeetingRequirements),
      rep.floor, rep.ceiling);
    const outstandingNow = round(payables.reduce((n, p) => n + p.amount, 0));
    months.push({month,startCash:round(startCash),endCash:round(cash),sold,built,revenue:round(revenue),
      costOfGoodsSold:round(cogs),procurement:round(procurement),fixedCost:fixed,developmentCost:development,
      depositsTaken:round(depositsTaken),payablesPaid:round(payablesPaid),payablesOutstanding:outstandingNow,
      orders,servedTotal,orderedTotal,reputationBefore:round(reputationBefore),reputationAfter:round(reputation),
      operatingProfit:monthProfit,inventoryCost:stockCost,inventoryUnits:Object.values(stock).reduce((n,p)=>n+p.length,0),
      capacityUsed:Object.fromEntries(Object.entries(used).map(([k,v])=>[k,round(v)])),capacityAvailable:limits,
      notices:[...new Set(notices)]});
    assert(Math.abs(cash - (startCash + cashFromSales + depositsTaken - cashProcurement - payablesPaid - fixed - development -
      (totalInvestment - months.slice(0,-1).reduce((n,m)=>n+(m.investmentPaid||0),0)))) < 0.02, 'Cash ledger does not reconcile.');
    months.at(-1).investmentPaid = totalInvestment - months.slice(0,-1).reduce((n,m)=>n+m.investmentPaid,0);
    for (const k of Object.keys(used)) assert(used[k] <= limits[k] + 1e-8, 'Capacity exceeded.');
    // A company that cannot cover its own month is insolvent; the run stops here.
    if (cash < 0) { bankrupt = true; bankruptMonth = month; }
  }
  const inventoryCost = round(Object.values(stock).flat().reduce((n,p)=>n+p,0));
  const payablesOutstanding = round(payables.reduce((n, p) => n + p.amount, 0));
  const operatingProfit = round(totalRevenue - totalCogs - totalFixed - totalDevelopment);
  // Parts bought on account are a liability, so they are added back before checking the ledger.
  assert(Math.abs(cash + inventoryCost - payablesOutstanding - opening.cash - (operatingProfit - totalInvestment)) < 0.02,
    'Operating profit, inventory, payables and cash do not reconcile.');
  if (bankrupt) assert(cash < 0, 'Bankruptcy must coincide with a negative cash balance.');
  return {route:routeId,scenario:scenarioId,difficulty,partsChannel:channel.id,partsChannelFactor:channelFactor,
    paymentTermMonths:termMonths,creditLimitCoins:creditLimit,gatedAtStart,reputation:round(reputation),
    totalDeposits:round(totalDeposits),totalPayablesPaid:round(totalPayablesPaid),payablesOutstanding,
    bankrupt,bankruptMonth,totalSales,totalRevenue,totalCostOfGoodsSold:round(totalCogs),
    totalFixedCost:totalFixed,totalDevelopmentCost:totalDevelopment,totalInvestment,
    operatingProfit,endCash:round(cash),inventoryCost,cashAndInventoryGain:round(cash+inventoryCost-opening.cash),months};
}

// Every route runs under each confirmed difficulty and each stress scenario; expansion dates stay as proposed.
const results = [];
for (const difficulty of Object.keys(config.opening))
  for (const scenario of Object.keys(config.scenarios))
    for (const route of Object.keys(config.routes)) results.push(simulate(route,scenario,difficulty));
const report = {status:'unconfirmed_candidate_scenarios',provenance:config.provenance,
  limitations:[
    'Capacity checks use monthly totals and owner design hours, not a dependency-aware event schedule.',
    'The owner performs design; employees and owner share other work. Only owner design availability is separately checked.',
    'Delivery costs are in direct costs. Lead times, release-day bottlenecks, component lots, returns, quality and reputation are not simulated.',
    'Stock retains historical cost. No markdown, resale, demand adaptation, depreciation or equipment residual value is modeled.',
    'Existing recipe variants are sold at assumed prices and all valid commissioned orders pay on completion.',
    'Demand is an assumed company sales ceiling, not a validated market forecast. First prototypes are sold, not discarded.'
  ],results};
fs.writeFileSync(path.join(root,'design','economy-review-results.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(results.map(({route,scenario,totalSales,operatingProfit,totalInvestment,endCash,inventoryCost,cashAndInventoryGain,months}) =>
  ({route,scenario,totalSales,operatingProfit,totalInvestment,endCash,inventoryCost,cashAndInventoryGain,
    constrainedMonths:months.filter(m=>m.notices.length).map(m=>({month:m.month,notices:m.notices}))})),null,2));

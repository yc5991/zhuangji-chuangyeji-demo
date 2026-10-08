// How much a customer is willing to pay, shared by the simulator and the customer checks.
// It lives here rather than in the simulator so that check-customers can use it without
// requiring the simulator, which requires check-customers in turn.
const fs = require('node:fs');
const path = require('node:path');
const customerModel = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'design', 'customer-model.json'), 'utf8'));

const archetypesByProduct = {};
for (const a of customerModel.archetypes) (archetypesByProduct[a.referenceRecipe] ||= []).push(a);

// A better-finished machine is worth more to the same customer, so it commands a higher price.
// The customer's willingness to pay moves; the quantity they want does not.
function appearancePricePremium(appearanceScore) {
  const pref = customerModel.appearancePreference;
  if (!pref) return 0;
  const span = 100 - pref.baselineScore;
  if (span <= 0) return 0;
  const above = Math.max(0, appearanceScore - pref.baselineScore);
  return (above / span) * pref.maxPricePremium;
}

// A finish the customer values raises both what they will pay and the ceiling they will pay up to,
// so the same asking price keeps the same acceptance while carrying the premium.
function acceptanceOf(productId, price, premium = 0) {
  const members = archetypesByProduct[productId] || [];
  if (!members.length) return 1;
  const weight = members.reduce((n, a) => n + a.weight, 0);
  const lift = 1 + premium;
  return members.reduce((n, a) => {
    // The archetype's budget maximum is a hard ceiling: nobody can buy what they cannot afford,
    // so a plan-limited route cannot sell at any price to a trickle of customers.
    if (price > a.budgetCoins[1] * lift) return n;
    const reference = ((a.budgetCoins[0] + a.budgetCoins[1]) / 2) * lift;
    const ratio = price / reference;
    const p = ratio <= 1
      ? Math.min(customerModel.priceAcceptance.ceiling, 1 + customerModel.priceAcceptance.belowSlope * (1 - ratio))
      : Math.max(customerModel.priceAcceptance.floor,
       1 - customerModel.priceAcceptance.aboveSlopeBySegment[a.segment === 'bespoke' || a.depositFraction > 0 ? 'bespoke' : 'mass'] * (ratio - 1));
    return n + a.weight * p;
  }, 0) / weight;
}

module.exports = { customerModel, archetypesByProduct, appearancePricePremium, acceptanceOf };

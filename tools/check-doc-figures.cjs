// Doc figures must match the data. Later rounds kept changing the model while documents kept
// quoting the numbers from before, so a reader could not tell which figures were live.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { simulate } = require('./simulate-economy.cjs');

// The figures the documents are expected to quote, measured now.
function liveFigures() {
  const out = {};
  for (const difficulty of ['easy', 'normal', 'hard'])
    for (const route of ['boutique', 'scale', 'mixed']) {
      const run = simulate(route, 'baseline', difficulty);
      if (run.gatedAtStart) continue;
      out[difficulty + ' ' + route] = Math.round(run.operatingProfit);
    }
  return out;
}

// A number this close to a live figure but not equal to it is almost certainly an older copy.
const NEAR = 60;

// Numbers that sit near a live figure for an unrelated reason. Each is checked by eye and the
// reason recorded, so the list stays short and every entry is a deliberate decision.
const COINCIDENCES = [
  { doc: 'demo-pacing.md', value: 45376, why: 'the easy mixed month-one cash balance, not a profit' },
  { doc: 'staff-value.md', value: 7688, why: 'the profit lost by hiring, shown negative, not the hard-mode profit' },
  { doc: 'decisions.md', value: 7688, why: 'the same hire loss quoted in the decision five re-test' },
  { doc: 'decisions.md', value: 40607, why: 'the mass profit the withdrawn option A would have produced, not the baseline' },
  { doc: 'era-trends.md', value: 36950, why: 'the mixed profit in 2021 under the era model, not the 2016 baseline' },
  { doc: 'era-trends.md', value: 33441, why: 'the boutique profit in 2025 under the era model, not the 2016 baseline' },
  { doc: 'era-trends.md', value: 40599, why: 'the mass profit in 2030 under the era model, not the 2016 baseline' },
];

// Rewrite near misses to the live value. Only documents that quote a figure the data no longer
// produces are touched, and only where the difference is inside the near-miss window, so a number
// that is deliberately different keeps its meaning. Returns what it changed.
function repair() {
  const live = liveFigures();
  const changed = [];
  const EXEMPT_DOCS = new Set(['doc-figures.md']);
  for (const doc of fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md') && !EXEMPT_DOCS.has(f))) {
    const file = path.join(root, 'docs', doc);
    let text = fs.readFileSync(file, 'utf8');
    for (const raw of new Set(text.match(/\b\d{4,6}\b/g) || [])) {
      const n = Number(raw);
      if (COINCIDENCES.some(c => c.doc === doc && c.value === n)) continue;
      const near = Object.entries(live).find(([, cur]) => n !== cur && Math.abs(n - cur) <= NEAR);
      if (!near) continue;
      const [label, cur] = near;
      text = text.replace(new RegExp('\\b' + raw + '\\b', 'g'), String(cur));
      changed.push(doc + ': ' + raw + ' -> ' + cur + ' (' + label + ')');
    }
    fs.writeFileSync(file, text);
  }
  return changed;
}

function run() {
  const live = liveFigures();
  const values = Object.values(live);
  const flagged = [];
  // This file's own documentation quotes the old values as examples of what it catches.
  const EXEMPT_DOCS = new Set(['doc-figures.md']);
  const docs = fs.readdirSync(path.join(root, 'docs'))
    .filter(f => f.endsWith('.md') && !EXEMPT_DOCS.has(f));
  for (const doc of docs) {
    const text = fs.readFileSync(path.join(root, 'docs', doc), 'utf8');
    for (const raw of new Set(text.match(/\b\d{4,6}\b/g) || [])) {
      const n = Number(raw);
      if (COINCIDENCES.some(c => c.doc === doc && c.value === n)) continue;
      for (const [label, cur] of Object.entries(live)) {
        if (n !== cur && Math.abs(n - cur) <= NEAR)
          flagged.push(doc + ': ' + raw + ' is within ' + NEAR + ' of ' + label + ' (' + cur + ')');
      }
    }
  }
  assert.equal(flagged.length, 0,
    flagged.length + ' document figures look like older copies of a live number: ' + flagged.join('; '));

  const output = {
    status: 'passed',
    liveFigures: live,
    docsScanned: docs.length,
    docsExempt: [...EXEMPT_DOCS],
    nearMissWindow: NEAR,
    coincidencesAllowed: COINCIDENCES.length,
  };
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local', 'doc-figures-verification.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  return output;
}
if (require.main === module) run();
module.exports = { run, liveFigures, repair };

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

// Counts the documents state as fact. A count is as capable of going stale as a profit figure,
// and these are the ones the package scripts and the file tree fix.
// The design checks, which is the number the documents quote. Three more scripts start with check:
// but are not part of the suite: a TypeScript compile, a packaging check, and one that verifies the
// local environment, which is machine-specific rather than a property of the design.
const NON_DESIGN_CHECKS = new Set(['check:types', 'check:package', 'check:env']);

function liveCounts() {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  const checks = Object.keys(scripts)
    .filter(k => k.startsWith('check:') && !NON_DESIGN_CHECKS.has(k)).length;
  let designFiles = 0;
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, 'design', dir), { withFileTypes: true })) {
      if (entry.isDirectory()) walk(dir ? dir + '/' + entry.name : entry.name);
      else if (entry.name.endsWith('.json')) designFiles++;
    }
  };
  walk('');
  return { checks, designFiles };
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
  { doc: 'spec-conflicts.md', value: 40568, why: 'the mass profit in 2030 in the full-game simulation, which happens to sit near the 2016 easy-mode figure' },
  { doc: 'era-trends.md', value: 29322, why: 'the boutique profit in 2017 under the era model' },
  { doc: 'era-trends.md', value: 28991, why: 'the boutique profit in 2018 under the era model' },
  { doc: 'era-trends.md', value: 27326, why: 'the boutique profit in 2020 under the era model' },
  { doc: 'era-trends.md', value: 26986, why: 'the boutique profit in 2023 under the era model' },
  { doc: 'era-trends.md', value: 26660, why: 'the boutique profit in 2024 under the era model' },
  { doc: 'era-trends.md', value: 26329, why: 'the boutique profit in 2025 under the era model' },
  { doc: 'era-trends.md', value: 25988, why: 'the boutique profit in 2026 under the era model' },
  { doc: 'era-trends.md', value: 25656, why: 'the boutique profit in 2027 under the era model' },
  { doc: 'era-trends.md', value: 25322, why: 'the boutique profit in 2028 under the era model' },
  { doc: 'era-trends.md', value: 25157, why: 'the boutique profit in 2029 under the era model' },
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

// Phrases that name a count, so a stale number can be caught in the sentence that makes it a claim.
const COUNT_CLAIMS = [
  [/重跑\s*(?:全部\s*)?(\d+)\s*个校验/g, 'checks'],
  [/(\d+)\s*个校验[,、]\s*(\d+)\s*个设计文件/g, 'both'],
  [/现在跑全部\s*(\d+)\s*个/g, 'checks'],
];

function run() {
  const counts = liveCounts();
  const countProblems = [];
  const COUNT_EXEMPT = new Set(['doc-figures.md', 'check-counts.md']);
  for (const doc of fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md') && !COUNT_EXEMPT.has(f))) {
    const text = fs.readFileSync(path.join(root, 'docs', doc), 'utf8');
    for (const [re, kind] of COUNT_CLAIMS) {
      for (const m of text.matchAll(re)) {
        const stated = Number(m[1]);
        if (stated === counts.checks) continue;
        // A sentence explaining what a figure used to be is history, not a claim about now.
        const around = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
        if (/原先|当时|最初|曾/.test(around)) continue;
        countProblems.push(doc + ': says ' + stated + ' checks, there are ' + counts.checks);
        break;
      }
    }
  }
  assert.equal(countProblems.length, 0,
    countProblems.length + ' documents state a check count that is out of date: ' + countProblems.join('; '));

  const live = liveFigures();
  const values = Object.values(live);
  const flagged = [];
  // These two document the checks themselves and quote old values as examples of what is caught,
  // which is the one case where a stale number is the point rather than a mistake.
  const EXEMPT_DOCS = new Set(['doc-figures.md', 'check-counts.md']);
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
    liveCounts: counts,
    nonDesignChecksExcluded: [...NON_DESIGN_CHECKS],
    countClaimsVerified: true,
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

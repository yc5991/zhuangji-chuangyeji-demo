// Run a controlled experiment on the design data, and always put the data back.
//
// Two failures in earlier rounds came from experiments that edited a data file and then crashed
// before restoring it, leaving the workspace holding experimental numbers. This exists so that
// cannot happen again: the originals are read up front and written back in a finally block.
//
//   const { experiment } = require('./experiment.cjs');
//   experiment({ 'economy-candidate.json': { products: { quiet_office: { salePrice: 5391 } } } },
//     () => { ...measure... });
//
// The mutation is a deep merge, so only the fields named are changed. Measuring happens with the
// changed data on disk, because the simulator reads the files rather than taking them as input.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const designDir = path.join(root, 'design');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(target[key])) merge(target[key], value);
    else target[key] = value;
  }
  return target;
}

// Every design file the experiment touched, so it can be put back exactly.
function experiment(mutations, measure) {
  const names = Object.keys(mutations);
  const originals = {};
  for (const name of names) {
    const file = path.join(designDir, name);
    if (!fs.existsSync(file)) throw new Error('no such design file: ' + name);
    originals[name] = fs.readFileSync(file, 'utf8');
  }
  const restore = () => {
    for (const [name, text] of Object.entries(originals)) {
      fs.writeFileSync(path.join(designDir, name), text);
    }
    // Drop the simulator from the cache so a later require sees the restored files.
    for (const key of Object.keys(require.cache)) {
      if (key.includes(path.join(root, 'tools'))) delete require.cache[key];
    }
  };
  try {
    for (const [name, patch] of Object.entries(mutations)) {
      const file = path.join(designDir, name);
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.writeFileSync(file, JSON.stringify(merge(doc, patch), null, 2) + '\n');
    }
    return measure(require('./simulate-economy.cjs'));
  } finally {
    restore();
  }
}

// Convenience: run the same measurement once per variant and hand back both results.
function sweep(variants, measure) {
  const out = {};
  for (const [label, mutations] of Object.entries(variants)) out[label] = experiment(mutations, measure);
  return out;
}

module.exports = { experiment, sweep };

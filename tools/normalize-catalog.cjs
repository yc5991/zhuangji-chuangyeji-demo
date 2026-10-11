// Normalize provenance paths without altering hardware facts or their confidence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = ['cpu-motherboard.json', 'gpu.json', 'memory-storage.json', 'structural.json'];
const resolve = (product, field) => field.split('.').reduce((value, key) => value?.[key], product);
function canonicalPath(product, field) {
  if (field.startsWith('specs.')) return field;
  if (resolve(product.specs, field) !== undefined) return `specs.${field}`;
  assert(resolve(product, field) !== undefined, `${product.id}: unresolved provenance path ${field}`);
  return field;
}
function migrate(write = false) {
  const report = {changedProducts: 0, renamedReferences: 0, removedAliases: 0, files: []};
  const writes = [];
  for (const file of files) {
    const filename = path.join(root, 'design/catalog-2016-2020', file);
    const before = fs.readFileSync(filename, 'utf8');
    const doc = JSON.parse(before);
    let changes = 0;
    for (const product of doc.products) {
      const original = JSON.parse(JSON.stringify(product));
      for (const kind of ['verifiedFields', 'inferredFields']) {
        const mapped = product[kind].map(field => {
          const normalized = canonicalPath(product, field);
          if (normalized !== field) changes++;
          return normalized;
        });
        product[kind] = [...new Set(mapped)];
        report.removedAliases += mapped.length - product[kind].length;
        for (const field of product[kind]) assert(resolve(product, field) !== undefined, `${product.id}: missing ${field}`);
      }
      assert(!product.inferredFields.some(field => product.verifiedFields.includes(field)), `${product.id}: conflicting provenance`);
      if (JSON.stringify(original) !== JSON.stringify(product)) report.changedProducts++;
      // Strip only the two renamed lists and prove that every other value is preserved.
      delete original.verifiedFields; delete original.inferredFields;
      const remaining = {...product}; delete remaining.verifiedFields; delete remaining.inferredFields;
      assert.deepEqual(remaining, original, `${product.id}: migration altered facts`);
    }
    const after = JSON.stringify(doc, null, 2) + '\n';
    if (after !== before && JSON.stringify(JSON.parse(before)) !== JSON.stringify(doc)) writes.push({filename, after});
    report.renamedReferences += changes;
    report.files.push({file, products: doc.products.length, renamedReferences: changes});
  }
  // Validate the entire directory before committing any migrated file.
  if (write) for (const {filename,after} of writes) fs.writeFileSync(filename,after);
  return report;
}
if (require.main === module) console.log(JSON.stringify(migrate(process.argv.includes('--write')), null, 2));
module.exports = {canonicalPath, resolve, migrate};

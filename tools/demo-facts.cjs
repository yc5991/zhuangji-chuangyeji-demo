// Facts about the demo that several tools need, read from the data rather than restated.
// DEMO_MONTHS, DIFFICULTY and FIRST_YEAR were each written out in two or three tools; they agreed,
// but nothing kept them agreeing. They now come from one place.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'design', name), 'utf8'));

// How many months the demo runs, from the schedule itself.
const DEMO_MONTHS = read('demo-schedule.json').months.length;
// The tier the balance is calibrated against. Every difficulty is measured, but comparisons and
// the regression baseline quote this one, so it is named once.
const DIFFICULTY = 'normal';
const SCENARIO = 'baseline';
// The first and last year of the full timeline, from the era model.
const ERA_YEARS = read('era-trends.json').years.map(y => y.year);
const FIRST_YEAR = ERA_YEARS[0];
const LAST_YEAR = ERA_YEARS[ERA_YEARS.length - 1];

module.exports = { DEMO_MONTHS, DIFFICULTY, SCENARIO, FIRST_YEAR, LAST_YEAR, ERA_YEARS };

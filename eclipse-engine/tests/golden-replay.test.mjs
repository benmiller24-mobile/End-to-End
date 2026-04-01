#!/usr/bin/env node
/**
 * Eclipse Kitchen Designer — Golden Reference Replay
 *
 * Runs the solver against all example inputs and scores against training data.
 * Reports: overlap count, validation errors, training match score, and
 * whether key appliances were placed correctly.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = join(import.meta.dirname, '..');
const { solve, scoreAgainstTraining } = await import(join(BASE, 'src/solver.js'));

const examplesDir = join(BASE, 'examples');
const files = readdirSync(examplesDir).filter(f => f.endsWith('.json'));

console.log('Eclipse Golden Reference Replay');
console.log('================================\n');

let totalOverlaps = 0;
let totalErrors = 0;

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(examplesDir, file), 'utf-8'));
  const input = raw.room ? { ...raw.room, materials: raw.materials } : raw;

  console.log(`▶ ${file}`);
  console.log(`  Walls: ${(input.walls || []).map(w => `${w.id}(${w.length}")`).join(', ')}`);
  console.log(`  Appliances: ${(input.appliances || []).map(a => `${a.type}(${a.width}")`).join(', ')}`);

  let result;
  try {
    result = solve(input);
  } catch (err) {
    console.log(`  ✗ CRASH: ${err.message}\n`);
    totalErrors++;
    continue;
  }

  // Check overlaps
  let overlapCount = 0;
  for (const wl of result.walls || []) {
    const cabs = [...(wl.cabinets || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
    for (let i = 1; i < cabs.length; i++) {
      const prevEnd = (cabs[i-1].position || 0) + (cabs[i-1].width || 0);
      if ((cabs[i].position || 0) < prevEnd - 0.5) {
        overlapCount++;
      }
    }
  }
  totalOverlaps += overlapCount;

  // Validation summary
  const errors = (result.validation || []).filter(v => v.severity === 'error');
  const warnings = (result.validation || []).filter(v => v.severity === 'warning');
  totalErrors += errors.length;

  // Training score
  let trainingScore = null;
  try {
    const ts = scoreAgainstTraining(result);
    trainingScore = ts;
  } catch (e) {
    trainingScore = { bestMatch: { name: 'ERROR', pct: 0 } };
  }

  // Placed appliances
  const allCabs = (result.walls || []).flatMap(w => w.cabinets || []);
  const placed = allCabs.filter(c => c.type === 'appliance').map(c => c.applianceType);
  const skipped = (result.validation || []).filter(v => v.type === 'no_space' || v.rule === 'no_space');

  console.log(`  Layout: ${result.layoutType} | ${result.metadata?.totalCabinets || '?'} cabs`);
  console.log(`  Placed: ${placed.join(', ') || 'none'}`);
  if (skipped.length) console.log(`  Skipped: ${skipped.map(s => s.message?.split('—')[0]?.trim()).join(', ')}`);
  console.log(`  Overlaps: ${overlapCount} | Errors: ${errors.length} | Warnings: ${warnings.length}`);

  if (trainingScore?.bestMatch) {
    console.log(`  Training match: ${trainingScore.bestMatch.name} (${trainingScore.bestMatch.pct}%)`);
  }
  if (trainingScore?.scored) {
    const top3 = trainingScore.scored.slice(0, 3);
    console.log(`  Top 3: ${top3.map(s => `${s.name}(${s.pct}%)`).join(', ')}`);
  }

  console.log('');
}

console.log('================================');
console.log(`TOTAL: ${totalOverlaps} overlaps, ${totalErrors} validation errors across ${files.length} examples`);
if (totalOverlaps === 0) console.log('✓ No overlaps detected in any layout!');
process.exit(totalOverlaps > 0 ? 1 : 0);

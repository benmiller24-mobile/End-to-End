/**
 * Eclipse Engine — CLI Tests
 * ==========================
 * Tests the command-line interface for the layout engine.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

let pass = 0, fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${msg}`);
  } else {
    fail++;
    console.log(`  ❌ ${msg}`);
  }
}

// Helper to run CLI and capture output
function runCli(args, stdin = null) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['cli.js', ...args], {
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    if (stdin) {
      proc.stdin.write(JSON.stringify(stdin));
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n═══ CLI Tests ═══\n');

  // Test 1: Help flag
  console.log('Test 1: --help flag');
  let result = await runCli(['--help']);
  assert(result.code === 0, 'Help exits with code 0');
  assert(result.stdout.includes('Usage:'), 'Help shows usage');
  assert(result.stdout.includes('quote'), 'Help mentions quote command');

  // Test 2: Version flag
  console.log('\nTest 2: --version flag');
  result = await runCli(['--version']);
  assert(result.code === 0, 'Version exits with code 0');
  assert(/^\d+\.\d+\.\d+/.test(result.stdout.trim()), 'Version matches semver');

  // Test 3: solve mode with valid input
  console.log('\nTest 3: solve mode with valid input');
  const solveInput = {
    layoutType: 'l-shape',
    walls: [
      { id: 'A', length: 96, role: 'general' },
      { id: 'B', length: 115, role: 'sink' },
    ],
    appliances: [
      { type: 'sink', width: 36, wall: 'B' },
      { type: 'dishwasher', width: 24, wall: 'B' },
    ],
    prefs: { cornerTreatment: 'lazySusan', preferDrawerBases: true },
  };

  result = await runCli(['solve'], solveInput);
  assert(result.code === 0, 'solve mode exits with code 0');

  let solveOutput = null;
  try {
    solveOutput = JSON.parse(result.stdout);
    assert(true, 'solve output is valid JSON');
  } catch {
    assert(false, 'solve output is valid JSON');
  }

  if (solveOutput) {
    assert(solveOutput.layoutType === 'l-shape', 'solve output has layoutType');
    assert(
      Array.isArray(solveOutput.placements),
      'solve output has placements array'
    );
    assert(solveOutput.metadata !== undefined, 'solve output has metadata');
  }

  // Test 4: quote mode with valid input
  console.log('\nTest 4: quote mode with valid input');
  const quoteInput = {
    room: {
      layoutType: 'l-shape',
      walls: [
        { id: 'A', length: 99, role: 'range' },
        { id: 'B', length: 115, role: 'sink' },
      ],
      appliances: [
        { type: 'range', width: 36, wall: 'A', position: 'center' },
        { type: 'sink', width: 36, wall: 'B' },
        { type: 'dishwasher', width: 24, wall: 'B' },
      ],
      prefs: { cornerTreatment: 'lazySusan', preferDrawerBases: true },
    },
    materials: {
      species: 'Maple',
      construction: 'Standard',
      doorStyle: 'Hanover FP',
    },
  };

  result = await runCli(['quote'], quoteInput);
  assert(result.code === 0, 'quote mode exits with code 0');

  let quoteOutput = null;
  try {
    quoteOutput = JSON.parse(result.stdout);
    assert(true, 'quote output is valid JSON');
  } catch {
    assert(false, 'quote output is valid JSON');
  }

  if (quoteOutput) {
    assert(quoteOutput.layout !== undefined, 'quote output has layout');
    assert(quoteOutput.pricing !== undefined, 'quote output has pricing');
  }

  // Test 5: Invalid JSON input
  console.log('\nTest 5: Invalid JSON input');
  result = await runCli(['solve'], null);
  result.stdout = 'not json'; // Simulate invalid input via manual test
  // We'll test this by providing bad stdin
  const invalidProc = spawn('node', ['cli.js', 'solve']);
  invalidProc.stdin.write('{ invalid json }');
  invalidProc.stdin.end();

  let exitCode = await new Promise((resolve) => {
    invalidProc.on('close', resolve);
  });
  assert(exitCode === 1, 'Invalid JSON exits with code 1');

  // Test 6: --file flag reads from file
  console.log('\nTest 6: --file flag');
  result = await runCli(['solve', '--file', 'examples/simple-kitchen.json']);
  assert(result.code === 0, 'solve with --file exits with code 0');

  let fileOutput = null;
  try {
    fileOutput = JSON.parse(result.stdout);
    assert(true, '--file output is valid JSON');
  } catch {
    assert(false, '--file output is valid JSON');
  }

  if (fileOutput) {
    assert(Array.isArray(fileOutput.placements), 'file output has placements');
  }

  // Test 7: --compact flag
  console.log('\nTest 7: --compact flag');
  result = await runCli(['solve', '--file', 'examples/simple-kitchen.json', '--compact']);
  assert(result.code === 0, 'solve with --compact exits with code 0');
  // Check that there's only one newline at the end (from console.log)
  const trimmedStdout = result.stdout.trim();
  assert(!trimmedStdout.includes('\n'), 'compact output is single line');

  let compactOutput = null;
  try {
    compactOutput = JSON.parse(result.stdout);
    assert(true, 'compact output is valid JSON');
  } catch {
    assert(false, 'compact output is valid JSON');
  }

  // Test 8: --summary flag
  console.log('\nTest 8: --summary flag');
  result = await runCli([
    'quote',
    '--file',
    'examples/l-shape-quote.json',
    '--summary',
  ]);
  assert(result.code === 0, 'quote with --summary exits with code 0');

  let summaryOutput = null;
  try {
    summaryOutput = JSON.parse(result.stdout);
    assert(true, 'summary output is valid JSON');
  } catch {
    assert(false, 'summary output is valid JSON');
  }

  if (summaryOutput) {
    assert(
      summaryOutput.hasOwnProperty('totalCabinets'),
      'summary has totalCabinets'
    );
    assert(
      summaryOutput.hasOwnProperty('totalPrice'),
      'summary has totalPrice'
    );
    assert(
      summaryOutput.hasOwnProperty('errors'),
      'summary has errors count'
    );
    assert(
      summaryOutput.hasOwnProperty('warnings'),
      'summary has warnings count'
    );
  }

  // Test 9: Missing command
  console.log('\nTest 9: Missing command');
  result = await runCli([]);
  assert(result.code === 1, 'missing command exits with code 1');
  assert(
    result.stderr.includes('Invalid command') ||
      result.stderr.includes('Valid commands'),
    'error message mentions invalid command'
  );

  // Test 10: Island kitchen quote
  console.log('\nTest 10: Island kitchen quote');
  result = await runCli([
    'quote',
    '--file',
    'examples/island-kitchen.json',
  ]);
  assert(result.code === 0, 'island kitchen quote exits with code 0');

  let islandOutput = null;
  try {
    islandOutput = JSON.parse(result.stdout);
    assert(true, 'island output is valid JSON');
  } catch {
    assert(false, 'island output is valid JSON');
  }

  if (islandOutput && islandOutput.layout) {
    assert(islandOutput.layout.island !== null, 'island kitchen has island layout');
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

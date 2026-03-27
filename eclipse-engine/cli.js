#!/usr/bin/env node

/**
 * Eclipse Cabinet Designer — CLI
 * ================================
 * Command-line interface for the layout engine.
 * Reads JSON input (stdin or file), runs solver/configurator, outputs JSON.
 *
 * Usage:
 *   node cli.js quote < input.json                   # Full quote from stdin
 *   node cli.js quote --file input.json              # Full quote from file
 *   node cli.js solve < input.json                   # Layout only from stdin
 *   node cli.js solve --file input.json              # Layout only from file
 *   node cli.js price < layout.json                  # Price existing layout
 *   node cli.js --help                               # Show help
 *   node cli.js --version                            # Show version
 *
 * Flags:
 *   --compact                       Minified JSON output (single line)
 *   --summary                       Output summary metrics only
 *   --file <path>                  Read input from file
 *   --help                          Show usage
 *   --version                       Show version
 */

import fs from 'fs';
import { configureProject, solve } from './src/index.js';

const VERSION = '0.1.0';

// Parse command-line arguments
function parseArgs(args) {
  const result = {
    command: null,
    file: null,
    compact: false,
    summary: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--compact') {
      result.compact = true;
    } else if (arg === '--summary') {
      result.summary = true;
    } else if (arg === '--file') {
      result.file = args[++i];
    } else if (!arg.startsWith('-')) {
      result.command = arg;
    }
  }

  return result;
}

// Print help message
function printHelp() {
  console.log(`
Eclipse Cabinet Designer — CLI v${VERSION}

Usage:
  node cli.js <command> [options] [--file <path>]

Commands:
  quote    Generate complete quote (solve + price)
  solve    Generate layout only
  price    Price existing layout
  help     Show this message

Options:
  --file <path>     Read input from file (instead of stdin)
  --compact         Output minified JSON (single line)
  --summary         Output summary metrics only
  --help, -h        Show this help
  --version, -v     Show version

Input Formats:

  quote mode expects:
  {
    "room": { layoutType, roomType, walls, appliances, prefs },
    "materials": { species, construction, doorStyle, ... }
  }

  solve mode expects:
  { layoutType, roomType, walls, appliances, prefs }

  price mode expects:
  Existing layout object from solve output

Output:
  Formatted JSON to stdout
  Errors to stderr (exit code 1)

Examples:
  # Full quote from file
  node cli.js quote --file kitchen.json

  # Layout only from stdin
  echo '{ "layoutType": "l-shape", ... }' | node cli.js solve

  # Minified output
  node cli.js quote --file input.json --compact

  # Summary only
  node cli.js quote --file input.json --summary
`);
}

// Format output
function formatOutput(data, options = {}) {
  if (options.compact) {
    return JSON.stringify(data);
  } else {
    return JSON.stringify(data, null, 2);
  }
}

// Extract summary from layout result
function extractSummary(result) {
  let totalCabinets = 0;
  let errors = [];
  let warnings = [];

  if (result.metadata) {
    totalCabinets = result.metadata.totalCabinets || 0;
  }

  if (result.validation) {
    if (Array.isArray(result.validation)) {
      errors = result.validation.filter(v => v.severity === 'error');
      warnings = result.validation.filter(v => v.severity === 'warning');
    }
  }

  return {
    totalCabinets,
    totalPrice: result.totalPrice || 0,
    errors: errors.length,
    warnings: warnings.length,
  };
}

// Extract summary from quote
function extractQuoteSummary(quote) {
  let totalCabinets = 0;
  let totalPrice = 0;
  let errors = 0;
  let warnings = 0;

  if (quote.layout) {
    totalCabinets = quote.layout.totalCabinets ||
                    quote.layout.metadata?.totalCabinets ||
                    0;
  }

  if (quote.pricing) {
    totalPrice = quote.pricing.total ||
                 quote.pricing.projectTotal ||
                 quote.pricing.specSubtotal ||
                 0;
  }

  if (quote.layout) {
    if (quote.layout.validationErrors && Array.isArray(quote.layout.validationErrors)) {
      errors = quote.layout.validationErrors.length;
    }
    if (quote.layout.validationWarnings && Array.isArray(quote.layout.validationWarnings)) {
      warnings = quote.layout.validationWarnings.length;
    }
  }

  if (quote.pricing && quote.pricing.warnings && Array.isArray(quote.pricing.warnings)) {
    warnings += quote.pricing.warnings.length;
  }

  return {
    totalCabinets,
    totalPrice: Math.round(totalPrice * 100) / 100,
    errors,
    warnings,
  };
}

// Read input from stdin (async)
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', reject);
  });
}

// Read input from file
function readFile(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`Error reading file: ${path}`);
    console.error(err.message);
    process.exit(1);
  }
}

// Parse JSON input
function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error('Error: Invalid JSON input');
    console.error(err.message);
    process.exit(1);
  }
}

// Main CLI handler
async function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (!opts.command || !['quote', 'solve', 'price'].includes(opts.command)) {
    console.error('Error: Invalid command');
    console.error('Valid commands: quote, solve, price, help');
    process.exit(1);
  }

  // Read input
  let input = '';
  if (opts.file) {
    input = readFile(opts.file);
  } else {
    input = await readStdin();
  }

  // Parse JSON
  const data = parseJson(input);

  try {
    let result;

    if (opts.command === 'quote') {
      if (!data.room) {
        throw new Error('quote mode requires "room" object');
      }
      result = configureProject(data);

      if (opts.summary) {
        result = extractQuoteSummary(result);
      }
    } else if (opts.command === 'solve') {
      result = solve(data);

      if (opts.summary) {
        result = extractSummary(result);
      }
    } else if (opts.command === 'price') {
      throw new Error('price mode not yet implemented');
    }

    // Output result
    console.log(formatOutput(result, opts));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

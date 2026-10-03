#!/usr/bin/env node

/**
 * Log query utility for DGOS V1
 *
 * Usage:
 *   pnpm logs:query --level=error --since=1h
 *   pnpm logs:follow --requestId=abc-123
 *   pnpm logs:query --component=api-server --operation="GET /api/v1/tasks"
 */

import { readFileSync, statSync, existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

// Configuration
const LOG_DIR = resolve(process.cwd(), 'logs');
const DEFAULT_LOG_FILE = resolve(LOG_DIR, 'api-server.log');

async function main() {
  const command = args._[0] || 'query';

  switch (command) {
    case 'query':
      await queryLogs(args);
      break;
    case 'follow':
      await followLogs(args);
      break;
    case 'stats':
      await showStats(args);
      break;
    default:
      showHelp();
  }
}

/**
 * Query logs with filters
 */
async function queryLogs(options) {
  const logFile = options.file || DEFAULT_LOG_FILE;

  if (!existsSync(logFile)) {
    console.error(`Log file not found: ${logFile}`);
    process.exit(1);
  }

  const filters = buildFilters(options);
  const limit = parseInt(options.limit) || 100;
  let count = 0;

  const rl = createInterface({
    input: createReadStream(logFile),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (count >= limit) break;

    try {
      const log = JSON.parse(line);

      if (matchesFilters(log, filters)) {
        printLog(log, options);
        count++;
      }
    } catch (error) {
      // Skip invalid JSON lines
    }
  }

  if (count === 0) {
    console.log('No logs found matching criteria');
  } else {
    console.log(`\n${count} logs found`);
  }
}

/**
 * Follow logs in real-time (tail -f style)
 */
async function followLogs(options) {
  const logFile = options.file || DEFAULT_LOG_FILE;
  const filters = buildFilters(options);

  console.log(`Following ${logFile}...`);
  console.log('Press Ctrl+C to stop\n');

  // Use tail -f via spawn
  const { spawn } = await import('node:child_process');
  const tail = spawn('tail', ['-f', logFile]);

  const rl = createInterface({
    input: tail.stdout,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const log = JSON.parse(line);

      if (matchesFilters(log, filters)) {
        printLog(log, options);
      }
    } catch (error) {
      // Skip invalid JSON lines
    }
  }
}

/**
 * Show log statistics
 */
async function showStats(options) {
  const logFile = options.file || DEFAULT_LOG_FILE;

  if (!existsSync(logFile)) {
    console.error(`Log file not found: ${logFile}`);
    process.exit(1);
  }

  const stats = {
    total: 0,
    byLevel: {},
    byComponent: {},
    errors: [],
    slowRequests: []
  };

  const rl = createInterface({
    input: createReadStream(logFile),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const log = JSON.parse(line);
      stats.total++;

      // Count by level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // Count by component
      if (log.component) {
        stats.byComponent[log.component] = (stats.byComponent[log.component] || 0) + 1;
      }

      // Track errors
      if (log.level === 'error') {
        stats.errors.push({
          timestamp: log.timestamp,
          message: log.message,
          component: log.component
        });
      }

      // Track slow requests
      if (log.duration && log.duration > 1000) {
        stats.slowRequests.push({
          timestamp: log.timestamp,
          duration: log.duration,
          path: log.path,
          method: log.method
        });
      }
    } catch (error) {
      // Skip invalid JSON lines
    }
  }

  // Print statistics
  console.log('Log Statistics');
  console.log('==============\n');

  console.log(`Total logs: ${stats.total}`);
  console.log('\nBy level:');
  for (const [level, count] of Object.entries(stats.byLevel).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${level}: ${count} (${(count / stats.total * 100).toFixed(1)}%)`);
  }

  console.log('\nBy component:');
  for (const [component, count] of Object.entries(stats.byComponent).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${component}: ${count}`);
  }

  if (stats.errors.length > 0) {
    console.log(`\nRecent errors (last ${Math.min(5, stats.errors.length)}):`);
    for (const error of stats.errors.slice(-5)) {
      console.log(`  [${error.timestamp}] ${error.component}: ${error.message}`);
    }
  }

  if (stats.slowRequests.length > 0) {
    console.log(`\nSlow requests (last ${Math.min(5, stats.slowRequests.length)}):`);
    for (const req of stats.slowRequests.slice(-5)) {
      console.log(`  [${req.timestamp}] ${req.method} ${req.path} - ${req.duration}ms`);
    }
  }
}

/**
 * Build filter functions from options
 */
function buildFilters(options) {
  const filters = [];

  // Level filter
  if (options.level) {
    filters.push(log => log.level === options.level);
  }

  // Component filter
  if (options.component) {
    filters.push(log => log.component === options.component);
  }

  // Request ID filter
  if (options.requestId) {
    filters.push(log => log.requestId === options.requestId);
  }

  // User ID filter
  if (options.userId) {
    filters.push(log => log.userId === options.userId);
  }

  // Operation filter
  if (options.operation) {
    filters.push(log => log.operation === options.operation);
  }

  // Message search
  if (options.search) {
    const search = options.search.toLowerCase();
    filters.push(log => log.message?.toLowerCase().includes(search));
  }

  // Time range filter
  if (options.since) {
    const sinceMs = parseDuration(options.since);
    const cutoff = Date.now() - sinceMs;
    filters.push(log => new Date(log.timestamp).getTime() >= cutoff);
  }

  // Duration filter (for slow requests)
  if (options.minDuration) {
    const minDuration = parseInt(options.minDuration);
    filters.push(log => log.duration && log.duration >= minDuration);
  }

  return filters;
}

/**
 * Check if log matches all filters
 */
function matchesFilters(log, filters) {
  return filters.every(filter => filter(log));
}

/**
 * Print log entry
 */
function printLog(log, options) {
  if (options.json) {
    console.log(JSON.stringify(log));
  } else if (options.compact) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    console.log(`[${time}] ${log.level.toUpperCase()} ${log.message}`);
  } else {
    const time = new Date(log.timestamp).toISOString();
    console.log(`[${time}] ${log.level.toUpperCase()} [${log.component || 'unknown'}]`);
    console.log(`  ${log.message}`);

    // Print relevant context
    const context = { ...log };
    delete context.timestamp;
    delete context.level;
    delete context.component;
    delete context.message;
    delete context.pid;
    delete context.hostname;

    if (Object.keys(context).length > 0) {
      console.log(`  ${JSON.stringify(context, null, 2).split('\n').join('\n  ')}`);
    }
    console.log('');
  }
}

/**
 * Parse duration string (1h, 30m, 60s)
 */
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * multipliers[unit];
}

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    } else {
      args._.push(arg);
    }
  }

  return args;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
DGOS Log Query Utility

Usage:
  pnpm logs:query [options]
  pnpm logs:follow [options]
  pnpm logs:stats [options]

Options:
  --file=PATH           Log file path (default: logs/api-server.log)
  --level=LEVEL         Filter by level (debug, info, warn, error)
  --component=NAME      Filter by component name
  --requestId=ID        Filter by request ID
  --userId=ID           Filter by user ID
  --operation=OP        Filter by operation name
  --search=TEXT         Search in log messages
  --since=DURATION      Show logs since duration (1h, 30m, 60s)
  --minDuration=MS      Show logs with duration >= MS
  --limit=N             Limit results (default: 100)
  --json                Output raw JSON
  --compact             Compact output format

Examples:
  # Show recent errors
  pnpm logs:query --level=error --since=1h

  # Follow logs for specific request
  pnpm logs:follow --requestId=abc-123

  # Show slow requests
  pnpm logs:query --minDuration=1000

  # Show logs from specific component
  pnpm logs:query --component=api-server --since=30m

  # Search logs
  pnpm logs:query --search="database connection" --level=error

  # Show statistics
  pnpm logs:stats
`);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

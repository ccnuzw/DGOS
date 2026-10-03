#!/usr/bin/env node
/**
 * DGOS V1 Data Export Tool
 * Export data in various formats with filtering and streaming support
 *
 * Usage:
 *   DGOS_DATABASE_URL=postgres://... node scripts/data-export.mjs <entity> [options]
 *
 * Entities:
 *   tasks, users, audit, models, config, packages, all
 *
 * Options:
 *   --format <format>      Output format: json, csv, yaml, sql (default: json)
 *   --output <file>        Output file (default: stdout)
 *   --since <date>         Export records since date (ISO 8601)
 *   --until <date>         Export records until date (ISO 8601)
 *   --filter <key=value>   Filter records (can be used multiple times)
 *   --fields <field,field> Export only specific fields
 *   --limit <number>       Limit number of records
 *   --stream               Use streaming for large datasets
 *   --pretty               Pretty-print JSON output
 *
 * Examples:
 *   node scripts/data-export.mjs audit --since="2024-10-01" --format=json
 *   node scripts/data-export.mjs users --format=csv --output=users.csv
 *   node scripts/data-export.mjs tasks --filter="status=completed" --limit=100
 */

import pg from '../apps/api/node_modules/pg/lib/index.js';
import { writeFile, createWriteStream } from 'node:fs';
import { promisify } from 'node:util';

const writeFileAsync = promisify(writeFile);

// Parse arguments
const [,, entity, ...argsList] = process.argv;

if (!entity) {
  console.error('Usage: node scripts/data-export.mjs <entity> [options]');
  console.error('Entities: tasks, users, audit, models, config, packages, all');
  process.exit(1);
}

const options = {
  format: 'json',
  output: null,
  since: null,
  until: null,
  filters: {},
  fields: null,
  limit: null,
  stream: false,
  pretty: false
};

// Parse options
for (let i = 0; i < argsList.length; i++) {
  const arg = argsList[i];
  if (arg === '--format' && argsList[i + 1]) {
    options.format = argsList[++i];
  } else if (arg === '--output' && argsList[i + 1]) {
    options.output = argsList[++i];
  } else if (arg === '--since' && argsList[i + 1]) {
    options.since = new Date(argsList[++i]);
  } else if (arg === '--until' && argsList[i + 1]) {
    options.until = new Date(argsList[++i]);
  } else if (arg === '--filter' && argsList[i + 1]) {
    const [key, value] = argsList[++i].split('=');
    options.filters[key] = value;
  } else if (arg === '--fields' && argsList[i + 1]) {
    options.fields = argsList[++i].split(',');
  } else if (arg === '--limit' && argsList[i + 1]) {
    options.limit = parseInt(argsList[++i]);
  } else if (arg === '--stream') {
    options.stream = true;
  } else if (arg === '--pretty') {
    options.pretty = true;
  }
}

const config = {
  dbUrl: process.env.DGOS_DATABASE_URL
};

if (!config.dbUrl) {
  console.error('Error: DGOS_DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 10000 });

/**
 * Build SQL query with filters
 */
function buildQuery(entity, options) {
  let table, timestampCol;

  switch (entity) {
    case 'tasks':
      table = 'quota_reservations';
      timestampCol = 'created_at';
      break;
    case 'users':
      table = 'admin_principals';
      timestampCol = 'created_at';
      break;
    case 'audit':
      table = 'audit_events';
      timestampCol = 'event_timestamp';
      break;
    case 'models':
      table = 'provider_accounts';
      timestampCol = 'created_at';
      break;
    case 'config':
      table = 'extension_registry';
      timestampCol = 'created_at';
      break;
    case 'packages':
      table = 'app_packages';
      timestampCol = 'created_at';
      break;
    default:
      throw new Error(`Unknown entity: ${entity}`);
  }

  const fields = options.fields ? options.fields.join(', ') : '*';
  let query = `SELECT ${fields} FROM ${table}`;
  const params = [];
  const conditions = [];

  // Add timestamp filters
  if (options.since) {
    params.push(options.since);
    conditions.push(`${timestampCol} >= $${params.length}`);
  }

  if (options.until) {
    params.push(options.until);
    conditions.push(`${timestampCol} <= $${params.length}`);
  }

  // Add custom filters
  for (const [key, value] of Object.entries(options.filters)) {
    params.push(value);
    conditions.push(`${key} = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` ORDER BY ${timestampCol}`;

  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  }

  return { query, params };
}

/**
 * Format data as CSV
 */
function formatCSV(rows) {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Format data as YAML
 */
function formatYAML(rows) {
  const yaml = [];
  for (const row of rows) {
    yaml.push('---');
    for (const [key, value] of Object.entries(row)) {
      yaml.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  return yaml.join('\n');
}

/**
 * Format data as SQL INSERT statements
 */
function formatSQL(rows, tableName) {
  if (rows.length === 0) return '';

  const sqls = [];
  const columns = Object.keys(rows[0]);

  for (const row of rows) {
    const values = columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    });

    sqls.push(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    );
  }

  return sqls.join('\n');
}

/**
 * Stream export for large datasets
 */
async function* streamExport(query, params) {
  const client = await pool.connect();
  try {
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const paginatedQuery = `${query} OFFSET ${offset} LIMIT ${batchSize}`;
      const result = await client.query(paginatedQuery, params);

      if (result.rows.length === 0) break;

      for (const row of result.rows) {
        yield row;
      }

      offset += result.rows.length;

      if (result.rows.length < batchSize) break;
    }
  } finally {
    client.release();
  }
}

/**
 * Export all entities
 */
async function exportAll() {
  const entities = ['users', 'audit', 'models', 'config', 'packages'];
  const exportData = {
    exported_at: new Date().toISOString(),
    entities: {}
  };

  for (const entity of entities) {
    try {
      const { query, params } = buildQuery(entity, { ...options, limit: null });
      const result = await pool.query(query, params);
      exportData.entities[entity] = result.rows;
      console.error(`   ${entity}: ${result.rows.length} records`, { via: 'stderr' });
    } catch (err) {
      console.error(`   ${entity}: Error - ${err.message}`, { via: 'stderr' });
      exportData.entities[entity] = [];
    }
  }

  return exportData;
}

/**
 * Main export process
 */
async function performExport() {
  console.error(`🚀 Exporting ${entity}...`, { via: 'stderr' });

  try {
    let output;

    if (entity === 'all') {
      const allData = await exportAll();
      output = options.pretty ? JSON.stringify(allData, null, 2) : JSON.stringify(allData);
    } else {
      if (options.stream) {
        // Streaming export
        console.error('   Using streaming mode', { via: 'stderr' });

        const { query, params } = buildQuery(entity, options);
        const stream = options.output ? createWriteStream(options.output) : process.stdout;

        if (options.format === 'json') {
          stream.write('[');
          let first = true;

          for await (const row of streamExport(query, params)) {
            if (!first) stream.write(',');
            stream.write(options.pretty ? JSON.stringify(row, null, 2) : JSON.stringify(row));
            first = false;
          }

          stream.write(']');
        } else {
          throw new Error('Streaming only supports JSON format');
        }

        if (options.output) {
          stream.end();
          console.error(`   ✅ Exported to ${options.output}`, { via: 'stderr' });
        }
        return;
      }

      // Regular export
      const { query, params } = buildQuery(entity, options);
      const result = await pool.query(query, params);
      const rows = result.rows;

      console.error(`   Found ${rows.length} records`, { via: 'stderr' });

      switch (options.format) {
        case 'json':
          output = options.pretty ? JSON.stringify(rows, null, 2) : JSON.stringify(rows);
          break;
        case 'csv':
          output = formatCSV(rows);
          break;
        case 'yaml':
          output = formatYAML(rows);
          break;
        case 'sql':
          output = formatSQL(rows, entity);
          break;
        default:
          throw new Error(`Unknown format: ${options.format}`);
      }
    }

    if (options.output) {
      await writeFileAsync(options.output, output);
      console.error(`   ✅ Exported to ${options.output}`, { via: 'stderr' });
    } else {
      console.log(output);
    }

  } catch (error) {
    console.error('❌ Export failed:', error.message, { via: 'stderr' });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

performExport();

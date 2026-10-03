// Output formatting utilities

import Table from 'cli-table3';
import yaml from 'js-yaml';

export type OutputFormat = 'json' | 'table' | 'yaml';

export function formatOutput(data: any, format: OutputFormat = 'json'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return yaml.dump(data);
    case 'table':
      return formatTable(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatTable(data: any): string {
  if (!data) return '';

  if (Array.isArray(data)) {
    if (data.length === 0) return 'No results';

    const keys = Object.keys(data[0]);
    const table = new Table({
      head: keys,
      style: { head: ['cyan'] },
    });

    for (const item of data) {
      table.push(keys.map(key => formatValue(item[key])));
    }

    return table.toString();
  } else if (typeof data === 'object') {
    const table = new Table({
      style: { head: ['cyan'] },
    });

    for (const [key, value] of Object.entries(data)) {
      table.push({ [key]: formatValue(value) });
    }

    return table.toString();
  }

  return String(data);
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function formatTaskStatus(status: string): string {
  const colors: Record<string, string> = {
    pending: '\x1b[33m', // yellow
    running: '\x1b[36m', // cyan
    completed: '\x1b[32m', // green
    failed: '\x1b[31m', // red
    cancelled: '\x1b[90m', // gray
  };

  const color = colors[status] || '';
  const reset = '\x1b[0m';

  return `${color}${status}${reset}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

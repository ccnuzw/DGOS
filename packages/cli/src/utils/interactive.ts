// Interactive CLI utilities for enhanced developer experience

import prompts from 'prompts';
import chalk from 'chalk';
import ora, { Ora } from 'ora';

export interface WizardStep {
  name: string;
  message: string;
  type: 'text' | 'select' | 'multiselect' | 'confirm' | 'number';
  choices?: Array<{ title: string; value: any; description?: string }>;
  initial?: any;
  validate?: (value: any) => boolean | string;
}

export async function runWizard(steps: WizardStep[]): Promise<Record<string, any>> {
  const responses: Record<string, any> = {};

  for (const step of steps) {
    const response = await prompts({
      type: step.type as any,
      name: step.name,
      message: chalk.cyan(step.message),
      choices: step.choices,
      initial: step.initial,
      validate: step.validate,
    });

    if (response[step.name] === undefined) {
      // User cancelled
      throw new Error('Wizard cancelled');
    }

    responses[step.name] = response[step.name];
  }

  return responses;
}

export function startSpinner(message: string): Ora {
  return ora(message).start();
}

export function successMessage(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function errorMessage(message: string): void {
  console.log(chalk.red('✗'), message);
}

export function warningMessage(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export function infoMessage(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export async function confirm(message: string, initial = false): Promise<boolean> {
  const response = await prompts({
    type: 'confirm',
    name: 'value',
    message: chalk.yellow(message),
    initial,
  });

  return response.value ?? false;
}

export function printHeader(title: string): void {
  console.log();
  console.log(chalk.bold.cyan('═'.repeat(title.length + 4)));
  console.log(chalk.bold.cyan(`  ${title}  `));
  console.log(chalk.bold.cyan('═'.repeat(title.length + 4)));
  console.log();
}

export function printSection(title: string): void {
  console.log();
  console.log(chalk.bold(title));
  console.log(chalk.gray('─'.repeat(title.length)));
}

export async function selectFromList<T>(
  message: string,
  items: Array<{ title: string; value: T; description?: string }>
): Promise<T | undefined> {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message: chalk.cyan(message),
    choices: items,
  });

  return response.value;
}

export async function multiSelectFromList<T>(
  message: string,
  items: Array<{ title: string; value: T; description?: string }>
): Promise<T[]> {
  const response = await prompts({
    type: 'multiselect',
    name: 'value',
    message: chalk.cyan(message),
    choices: items,
    instructions: chalk.gray('\nSpace to select, Enter to confirm'),
  });

  return response.value ?? [];
}

export function printProgress(current: number, total: number, message: string): void {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

  process.stdout.write(`\r${chalk.cyan(bar)} ${percentage}% ${message}`);

  if (current === total) {
    process.stdout.write('\n');
  }
}

// Build utilities for production optimization

import * as fs from 'fs/promises';
import * as path from 'path';
import { execaCommand } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import * as tar from 'tar';

export interface BuildOptions {
  projectDir: string;
  outputDir: string;
  production: boolean;
  minify?: boolean;
  sourceMaps?: boolean;
  analyze?: boolean;
}

export interface BuildResult {
  success: boolean;
  outputDir: string;
  files: string[];
  size: number;
  errors?: string[];
}

export class Builder {
  constructor(private options: BuildOptions) {}

  async build(): Promise<BuildResult> {
    const { projectDir, outputDir, production } = this.options;
    const spinner = ora('Building application...').start();

    try {
      // Clean output directory
      spinner.text = 'Cleaning output directory...';
      await this.cleanDirectory(outputDir);

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Load manifest
      const manifest = await this.loadManifest(projectDir);
      spinner.succeed('Manifest loaded');

      // Validate manifest
      spinner.start('Validating manifest...');
      await this.validateManifest(manifest);
      spinner.succeed('Manifest validated');

      // Copy and process files
      spinner.start('Processing files...');
      const files = await this.processFiles(projectDir, outputDir, manifest);
      spinner.succeed(`Processed ${files.length} files`);

      // Optimize assets
      if (production && this.options.minify) {
        spinner.start('Optimizing assets...');
        await this.optimizeAssets(outputDir);
        spinner.succeed('Assets optimized');
      }

      // Calculate total size
      const size = await this.calculateSize(outputDir);

      // Generate bundle analysis
      if (this.options.analyze) {
        spinner.start('Generating bundle analysis...');
        await this.generateAnalysis(outputDir, files, size);
        spinner.succeed('Bundle analysis generated');
      }

      return {
        success: true,
        outputDir,
        files,
        size,
      };
    } catch (error) {
      spinner.fail('Build failed');
      return {
        success: false,
        outputDir,
        files: [],
        size: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async cleanDirectory(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  }

  private async loadManifest(projectDir: string): Promise<any> {
    const manifestPath = path.join(projectDir, 'dgos.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  private async validateManifest(manifest: any): Promise<void> {
    const required = [
      'format',
      'appId',
      'version',
      'name',
      'description',
      'entrypoints',
    ];

    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest: ${field}`);
      }
    }

    if (manifest.format !== 'dgos-app/v1') {
      throw new Error(`Invalid format: ${manifest.format}`);
    }
  }

  private async processFiles(
    projectDir: string,
    outputDir: string,
    manifest: any
  ): Promise<string[]> {
    const files: string[] = [];

    // Copy source files
    const srcDir = path.join(projectDir, 'src');
    const outputSrcDir = path.join(outputDir, 'src');
    await this.copyDirectory(srcDir, outputSrcDir, files);

    // Copy public files
    const publicDir = path.join(projectDir, 'public');
    try {
      await fs.access(publicDir);
      const outputPublicDir = path.join(outputDir, 'public');
      await this.copyDirectory(publicDir, outputPublicDir, files);
    } catch {
      // Public directory doesn't exist
    }

    // Copy manifest
    const manifestPath = path.join(outputDir, 'dgos.json');
    await fs.copyFile(path.join(projectDir, 'dgos.json'), manifestPath);
    files.push(manifestPath);

    // Copy package.json if exists
    try {
      const pkgPath = path.join(projectDir, 'package.json');
      await fs.access(pkgPath);
      await fs.copyFile(pkgPath, path.join(outputDir, 'package.json'));
      files.push(path.join(outputDir, 'package.json'));
    } catch {
      // package.json doesn't exist
    }

    return files;
  }

  private async copyDirectory(src: string, dest: string, files: string[]): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath, files);
      } else {
        await fs.copyFile(srcPath, destPath);
        files.push(destPath);
      }
    }
  }

  private async optimizeAssets(outputDir: string): Promise<void> {
    // In a real implementation, this would:
    // - Minify JavaScript files
    // - Minify CSS files
    // - Compress images
    // - Remove comments
    // - Tree-shake unused code
    // For now, we'll just log
    console.log(chalk.gray('  Asset optimization placeholder'));
  }

  private async calculateSize(dir: string): Promise<number> {
    let totalSize = 0;

    const walk = async (directory: string): Promise<void> => {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    };

    await walk(dir);
    return totalSize;
  }

  private async generateAnalysis(outputDir: string, files: string[], totalSize: number): Promise<void> {
    const analysis = {
      totalSize,
      totalFiles: files.length,
      files: await Promise.all(
        files.map(async (file) => {
          const stats = await fs.stat(file);
          return {
            path: path.relative(outputDir, file),
            size: stats.size,
            percentage: ((stats.size / totalSize) * 100).toFixed(2),
          };
        })
      ),
    };

    const analysisPath = path.join(outputDir, 'build-analysis.json');
    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2));

    console.log();
    console.log(chalk.bold('Build Analysis:'));
    console.log(chalk.gray(`  Output: ${analysisPath}`));
    console.log(chalk.gray(`  Total Size: ${this.formatSize(totalSize)}`));
    console.log(chalk.gray(`  Total Files: ${files.length}`));
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

export async function createPackage(buildDir: string, outputFile: string): Promise<void> {
  const spinner = ora('Creating package...').start();

  try {
    await tar.create(
      {
        gzip: true,
        file: outputFile,
        cwd: buildDir,
      },
      ['.']
    );

    const stats = await fs.stat(outputFile);
    spinner.succeed(`Package created: ${outputFile} (${formatFileSize(stats.size)})`);
  } catch (error) {
    spinner.fail('Failed to create package');
    throw error;
  }
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

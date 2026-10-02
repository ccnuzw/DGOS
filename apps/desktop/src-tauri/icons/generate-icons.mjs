#!/usr/bin/env node
/**
 * Generate PNG icons from SVG at various sizes for macOS app
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the SVG content
const svgContent = readFileSync(join(__dirname, 'icon.svg'), 'utf-8');

// Target sizes for macOS icons
const sizes = [
  { size: 16, name: 'icon_16x16.png' },
  { size: 32, name: 'icon_32x32.png' },
  { size: 128, name: 'icon_128x128.png' },
  { size: 256, name: 'icon_256x256.png' },
  { size: 512, name: 'icon_512x512.png' },
  { size: 1024, name: 'icon.png' }, // Main icon
];

console.log('SVG icon ready at:', join(__dirname, 'icon.svg'));
console.log('\nTo generate PNG files, you can use one of these methods:\n');
console.log('1. Online converter: https://cloudconvert.com/svg-to-png');
console.log('2. Install rsvg-convert: brew install librsvg');
console.log('   Then run: rsvg-convert -w 1024 -h 1024 icon.svg > icon.png');
console.log('3. Use ImageMagick: brew install imagemagick');
console.log('   Then run: convert -density 300 -resize 1024x1024 icon.svg icon.png');
console.log('\nRequired sizes:', sizes.map(s => `${s.size}x${s.size}`).join(', '));
console.log('\nFor now, creating a simple fallback...');

// Create a simple Node.js canvas-based converter as fallback
try {
  // Try to use sharp if available
  const sharp = await import('sharp').catch(() => null);

  if (sharp) {
    console.log('\nUsing sharp to generate PNG files...');
    const svgBuffer = Buffer.from(svgContent);

    for (const { size, name } of sizes) {
      await sharp.default(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(__dirname, name));
      console.log(`✓ Generated ${name} (${size}x${size})`);
    }

    console.log('\n✓ All icons generated successfully!');
  } else {
    console.log('\nSharp not available. Please install conversion tools or use online converter.');
    console.log('To install sharp: npm install sharp');
  }
} catch (error) {
  console.error('\nError generating icons:', error.message);
  console.log('\nPlease use an online converter or install librsvg/imagemagick.');
}

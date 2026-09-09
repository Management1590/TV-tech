// generate-all-logo-assets.mjs
// Master script to generate all logo variations, platform icons, sizes, and formats.
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, 'public');
const logoAssetsDir = join(publicDir, 'assets/logo');
const iconsDir = join(publicDir, 'icons');

// Ensure directories exist
[publicDir, logoAssetsDir, iconsDir].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// SVG Generator function supporting all required variations
function generateSvg(variation = 'gradient') {
  switch (variation) {
    case 'gradient': // Primary Brand Gradient
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="topBlue" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#1D4ED8"/>
      <stop offset="40%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
    <linearGradient id="bottomBlue" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="60%" stop-color="#60A5FA"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
    <filter id="layerShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1E3A8A" flood-opacity="0.20"/>
    </filter>
  </defs>
  <clipPath id="folderClip">
    <path d="
      M 112 60
      L 190 60
      C 224 60, 240 76, 256 108
      C 268 132, 284 142, 316 142
      L 404 142
      C 436 142, 456 162, 456 194
      L 456 392
      C 456 424, 436 444, 404 444
      L 108 444
      C 76 444, 56 424, 56 392
      L 56 116
      C 56 84, 76 60, 112 60
      Z
    "/>
  </clipPath>
  <g clip-path="url(#folderClip)">
    <rect x="0" y="0" width="512" height="512" fill="url(#bottomBlue)" />
    <path d="
      M 0 0
      L 512 0
      L 512 216
      L 310 292
      C 275 306, 237 306, 202 292
      L 0 216
      Z
    " fill="url(#topBlue)" filter="url(#layerShadow)" />
    <path d="
      M 0 208
      L 202 284
      C 237 298, 275 298, 310 284
      L 512 208
      L 512 226
      L 310 302
      C 275 316, 237 316, 202 302
      L 0 226
      Z
    " fill="#FFFFFF" opacity="0.96" />
  </g>
</svg>`;

    case 'solid-blue': // Solid Blue Flat
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <clipPath id="folderClipSolid">
    <path d="
      M 112 60
      L 190 60
      C 224 60, 240 76, 256 108
      C 268 132, 284 142, 316 142
      L 404 142
      C 436 142, 456 162, 456 194
      L 456 392
      C 456 424, 436 444, 404 444
      L 108 444
      C 76 444, 56 424, 56 392
      L 56 116
      C 56 84, 76 60, 112 60
      Z
    "/>
  </clipPath>
  <g clip-path="url(#folderClipSolid)">
    <rect x="0" y="0" width="512" height="512" fill="#3B82F6" />
    <path d="
      M 0 0
      L 512 0
      L 512 216
      L 310 292
      C 275 306, 237 306, 202 292
      L 0 216
      Z
    " fill="#2563EB" />
    <path d="
      M 0 208
      L 202 284
      C 237 298, 275 298, 310 284
      L 512 208
      L 512 226
      L 310 302
      C 275 316, 237 316, 202 302
      L 0 226
      Z
    " fill="#FFFFFF" />
  </g>
</svg>`;

    case 'monochrome-dark': // Dark Slate / Night
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <clipPath id="folderClipDark">
    <path d="
      M 112 60
      L 190 60
      C 224 60, 240 76, 256 108
      C 268 132, 284 142, 316 142
      L 404 142
      C 436 142, 456 162, 456 194
      L 456 392
      C 456 424, 436 444, 404 444
      L 108 444
      C 76 444, 56 424, 56 392
      L 56 116
      C 56 84, 76 60, 112 60
      Z
    "/>
  </clipPath>
  <g clip-path="url(#folderClipDark)">
    <rect x="0" y="0" width="512" height="512" fill="#27272A" />
    <path d="
      M 0 0
      L 512 0
      L 512 216
      L 310 292
      C 275 306, 237 306, 202 292
      L 0 216
      Z
    " fill="#09090B" />
    <path d="
      M 0 208
      L 202 284
      C 237 298, 275 298, 310 284
      L 512 208
      L 512 226
      L 310 302
      C 275 316, 237 316, 202 302
      L 0 226
      Z
    " fill="#FFFFFF" />
  </g>
</svg>`;

    case 'monochrome-gray': // Cool Slate Gray
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <clipPath id="folderClipGray">
    <path d="
      M 112 60
      L 190 60
      C 224 60, 240 76, 256 108
      C 268 132, 284 142, 316 142
      L 404 142
      C 436 142, 456 162, 456 194
      L 456 392
      C 456 424, 436 444, 404 444
      L 108 444
      C 76 444, 56 424, 56 392
      L 56 116
      C 56 84, 76 60, 112 60
      Z
    "/>
  </clipPath>
  <g clip-path="url(#folderClipGray)">
    <rect x="0" y="0" width="512" height="512" fill="#94A3B8" />
    <path d="
      M 0 0
      L 512 0
      L 512 216
      L 310 292
      C 275 306, 237 306, 202 292
      L 0 216
      Z
    " fill="#64748B" />
    <path d="
      M 0 208
      L 202 284
      C 237 298, 275 298, 310 284
      L 512 208
      L 512 226
      L 310 302
      C 275 316, 237 316, 202 302
      L 0 226
      Z
    " fill="#FFFFFF" />
  </g>
</svg>`;

    case 'outline': // Precision Line / Outline
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <path d="
    M 112 60
    L 190 60
    C 224 60, 240 76, 256 108
    C 268 132, 284 142, 316 142
    L 404 142
    C 436 142, 456 162, 456 194
    L 456 392
    C 456 424, 436 444, 404 444
    L 108 444
    C 76 444, 56 424, 56 392
    L 56 116
    C 56 84, 76 60, 112 60
    Z
  " fill="none" stroke="#2563EB" stroke-width="22" stroke-linejoin="round" stroke-linecap="round" />
  <path d="
    M 56 216
    L 202 292
    C 237 306, 275 306, 310 292
    L 456 216
  " fill="none" stroke="#2563EB" stroke-width="22" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;

    case 'reverse-white': // Reverse White on Blue Container
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgBlue" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#1D4ED8"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bgBlue)"/>
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <clipPath id="folderClipRev">
      <path d="
        M 112 60
        L 190 60
        C 224 60, 240 76, 256 108
        C 268 132, 284 142, 316 142
        L 404 142
        C 436 142, 456 162, 456 194
        L 456 392
        C 456 424, 436 444, 404 444
        L 108 444
        C 76 444, 56 424, 56 392
        L 56 116
        C 56 84, 76 60, 112 60
        Z
      "/>
    </clipPath>
    <g clip-path="url(#folderClipRev)">
      <rect x="0" y="0" width="512" height="512" fill="#F1F5F9" />
      <path d="
        M 0 0
        L 512 0
        L 512 216
        L 310 292
        C 275 306, 237 306, 202 292
        L 0 216
        Z
      " fill="#FFFFFF" />
      <path d="
        M 0 208
        L 202 284
        C 237 298, 275 298, 310 284
        L 512 208
        L 512 226
        L 310 302
        C 275 316, 237 316, 202 302
        L 0 226
        Z
      " fill="#2563EB" opacity="0.9" />
    </g>
  </g>
</svg>`;

    case 'app-icon-light': // iOS / macOS / Web Light App Icon with Squircle
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="topBlue" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#1D4ED8"/>
      <stop offset="40%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
    <linearGradient id="bottomBlue" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="60%" stop-color="#60A5FA"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
    <filter id="iconShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1E3A8A" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="115" fill="#FFFFFF"/>
  <rect width="512" height="512" rx="115" fill="none" stroke="rgba(0,0,0,0.04)" stroke-width="2"/>
  <g transform="translate(64, 64) scale(0.75)" filter="url(#iconShadow)">
    <clipPath id="folderClipApp">
      <path d="
        M 112 60
        L 190 60
        C 224 60, 240 76, 256 108
        C 268 132, 284 142, 316 142
        L 404 142
        C 436 142, 456 162, 456 194
        L 456 392
        C 456 424, 436 444, 404 444
        L 108 444
        C 76 444, 56 424, 56 392
        L 56 116
        C 56 84, 76 60, 112 60
        Z
      "/>
    </clipPath>
    <g clip-path="url(#folderClipApp)">
      <rect x="0" y="0" width="512" height="512" fill="url(#bottomBlue)" />
      <path d="
        M 0 0
        L 512 0
        L 512 216
        L 310 292
        C 275 306, 237 306, 202 292
        L 0 216
        Z
      " fill="url(#topBlue)" />
      <path d="
        M 0 208
        L 202 284
        C 237 298, 275 298, 310 284
        L 512 208
        L 512 226
        L 310 302
        C 275 316, 237 316, 202 302
        L 0 226
        Z
      " fill="#FFFFFF" opacity="0.96" />
    </g>
  </g>
</svg>`;

    case 'app-icon-dark': // Dark App Icon with Squircle
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="topBlue" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#1D4ED8"/>
      <stop offset="40%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
    <linearGradient id="bottomBlue" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="60%" stop-color="#60A5FA"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
    <filter id="iconShadowDark" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="115" fill="#0B132B"/>
  <rect width="512" height="512" rx="115" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <g transform="translate(64, 64) scale(0.75)" filter="url(#iconShadowDark)">
    <clipPath id="folderClipAppDark">
      <path d="
        M 112 60
        L 190 60
        C 224 60, 240 76, 256 108
        C 268 132, 284 142, 316 142
        L 404 142
        C 436 142, 456 162, 456 194
        L 456 392
        C 456 424, 436 444, 404 444
        L 108 444
        C 76 444, 56 424, 56 392
        L 56 116
        C 56 84, 76 60, 112 60
        Z
      "/>
    </clipPath>
    <g clip-path="url(#folderClipAppDark)">
      <rect x="0" y="0" width="512" height="512" fill="url(#bottomBlue)" />
      <path d="
        M 0 0
        L 512 0
        L 512 216
        L 310 292
        C 275 306, 237 306, 202 292
        L 0 216
        Z
      " fill="url(#topBlue)" />
      <path d="
        M 0 208
        L 202 284
        C 237 298, 275 298, 310 284
        L 512 208
        L 512 226
        L 310 302
        C 275 316, 237 316, 202 302
        L 0 226
        Z
      " fill="#FFFFFF" opacity="0.96" />
    </g>
  </g>
</svg>`;
  }
}

// Multi-size ICO Builder
function buildIco(entries) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = entries.length;
  let dataOffset = headerSize + (dirEntrySize * numImages);
  const dirEntries = [];

  for (const entry of entries) {
    dirEntries.push({
      width: entry.size >= 256 ? 0 : entry.size,
      height: entry.size >= 256 ? 0 : entry.size,
      dataSize: entry.png.length,
      dataOffset: dataOffset,
      png: entry.png,
    });
    dataOffset += entry.png.length;
  }

  const totalSize = dataOffset;
  const buffer = Buffer.alloc(totalSize);

  // ICO Header
  buffer.writeUInt16LE(0, 0); // Reserved
  buffer.writeUInt16LE(1, 2); // Type: ICO
  buffer.writeUInt16LE(numImages, 4); // Count

  // Directory entries
  let offset = headerSize;
  for (const entry of dirEntries) {
    buffer.writeUInt8(entry.width, offset);
    buffer.writeUInt8(entry.height, offset + 1);
    buffer.writeUInt8(0, offset + 2); // Color palette
    buffer.writeUInt8(0, offset + 3); // Reserved
    buffer.writeUInt16LE(1, offset + 4); // Color planes
    buffer.writeUInt16LE(32, offset + 6); // Bits per pixel
    buffer.writeUInt32LE(entry.dataSize, offset + 8);
    buffer.writeUInt32LE(entry.dataOffset, offset + 12);
    offset += dirEntrySize;
  }

  // Image data
  for (const entry of dirEntries) {
    entry.png.copy(buffer, entry.dataOffset);
  }

  return buffer;
}

const variations = [
  'gradient',
  'solid-blue',
  'monochrome-dark',
  'monochrome-gray',
  'reverse-white',
  'outline',
  'app-icon-light',
  'app-icon-dark',
];

const standardSizes = [1024, 512, 256, 128, 64, 32, 16];

async function main() {
  console.log('🚀 Generating Full Suite of Logo Assets & Platform Icons...\n');

  // 1. Generate SVGs and PNGs for all variations
  for (const variation of variations) {
    const varDir = join(logoAssetsDir, variation);
    if (!existsSync(varDir)) mkdirSync(varDir, { recursive: true });

    const svgContent = generateSvg(variation);
    const svgPath = join(varDir, `logo-${variation}.svg`);
    writeFileSync(svgPath, svgContent);
    console.log(`📁 Variation [${variation}]: SVG saved`);

    const svgBuffer = Buffer.from(svgContent);

    // Generate PNGs at all standard sizes
    for (const size of standardSizes) {
      const pngPath = join(varDir, `logo-${variation}-${size}x${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ quality: 100 })
        .toFile(pngPath);
    }

    // Generate WebP at 512 and 192
    for (const size of [512, 192]) {
      const webpPath = join(varDir, `logo-${variation}-${size}x${size}.webp`);
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 95 })
        .toFile(webpPath);
    }
  }

  // 2. Generate Primary App SVGs & Root Public Files
  const primarySvg = generateSvg('gradient');
  const appIconLightSvg = generateSvg('app-icon-light');

  writeFileSync(join(publicDir, 'logo.svg'), primarySvg);
  writeFileSync(join(iconsDir, 'logo.svg'), primarySvg);

  const primaryBuffer = Buffer.from(primarySvg);
  const appIconBuffer = Buffer.from(appIconLightSvg);

  // 3. Platform Specific Exports

  // Web & Favicons
  for (const size of [16, 32, 48, 64, 128, 192, 256, 384, 512, 1024]) {
    await sharp(primaryBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ quality: 100 })
      .toFile(join(iconsDir, `icon-${size}x${size}.png`));
  }

  await sharp(primaryBuffer)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-16x16.png'));

  await sharp(primaryBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'));

  // Multi-resolution ICO for Windows / Web (16, 24, 32, 48, 64, 128, 256)
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoEntries = [];
  for (const size of icoSizes) {
    const pngBuf = await sharp(primaryBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    icoEntries.push({ size, png: pngBuf });
  }
  const icoFile = buildIco(icoEntries);
  writeFileSync(join(publicDir, 'favicon.ico'), icoFile);
  writeFileSync(join(logoAssetsDir, 'favicon.ico'), icoFile);
  console.log('✅ Generated multi-resolution favicon.ico (16, 24, 32, 48, 64, 128, 256)');

  // iOS Apple Touch Icon (180x180 with squircle / clean background)
  await sharp(appIconBuffer)
    .resize(180, 180, { fit: 'contain' })
    .png({ quality: 100 })
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  await sharp(appIconBuffer)
    .resize(180, 180, { fit: 'contain' })
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'apple-touch-icon-180x180.png'));
  console.log('✅ Generated iOS Apple Touch Icon (180x180)');

  // Android Chrome Launcher Icons & Maskable Icon
  await sharp(primaryBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'android-chrome-192x192.png'));

  await sharp(primaryBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'android-chrome-512x512.png'));

  // Android Adaptive / Maskable Icon (512x512 with safe-zone margin)
  const maskableSize = 512;
  const innerSize = Math.round(maskableSize * 0.72);
  const padding = Math.round((maskableSize - innerSize) / 2);
  await sharp(primaryBuffer)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 100 })
    .toFile(join(iconsDir, 'maskable-icon-512x512.png'));
  console.log('✅ Generated Android Maskable Icon (512x512 with 72% safe zone)');

  // WebP versions
  await sharp(primaryBuffer)
    .resize(512, 512)
    .webp({ quality: 95 })
    .toFile(join(iconsDir, 'icon-512x512.webp'));
  await sharp(primaryBuffer)
    .resize(192, 192)
    .webp({ quality: 95 })
    .toFile(join(iconsDir, 'icon-192x192.webp'));

  console.log('\n🎉 ALL LOGO ASSETS & PLATFORM PACKS SUCCESSFULLY GENERATED!');
}

main().catch(console.error);

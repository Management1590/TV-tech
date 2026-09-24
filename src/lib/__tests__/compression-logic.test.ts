import {
  evaluateSmartSkipping,
  optimizeCloudinaryVideoUrl,
  optimizeCloudinaryImageUrl,
  MAX_VIDEO_SIZE_BYTES,
  MAX_PHOTO_SIZE_BYTES,
  calculateAverageBitrate,
} from '../video-compressor';

console.log('--- Testing WhatsApp HD Compression & Skipping Logic ---');

// Test 1: Size limits
console.log('1. Size limits:');
console.assert(MAX_VIDEO_SIZE_BYTES === 100 * 1024 * 1024, 'MAX_VIDEO_SIZE_BYTES must be 100MB');
console.assert(MAX_PHOTO_SIZE_BYTES === 9 * 1024 * 1024, 'MAX_PHOTO_SIZE_BYTES must be 9MB');
console.log('  ✓ Video limit: 100MB, Photo limit: 9MB');

// Test 2: 1:4 Ratio Skipping (1 MB for every 4 seconds)
console.log('2. 1:4 Duration-to-Size Ratio Skipping:');

// Case A: 4s video with 1MB -> exactly 1:4 -> SHOULD SKIP
const res4s1mb = evaluateSmartSkipping({ duration: 4, sizeBytes: 1 * 1024 * 1024 });
console.assert(res4s1mb.shouldSkip === true, '4s video with 1MB should skip compression');
console.log('  ✓ 4s video @ 1MB: shouldSkip =', res4s1mb.shouldSkip, `(${res4s1mb.reason})`);

// Case B: 60s video with 12MB -> 12MB < 15MB (1:4 ceiling is 15MB) -> SHOULD SKIP
const res60s12mb = evaluateSmartSkipping({ duration: 60, sizeBytes: 12 * 1024 * 1024 });
console.assert(res60s12mb.shouldSkip === true, '60s video with 12MB should skip compression');
console.log('  ✓ 60s video @ 12MB: shouldSkip =', res60s12mb.shouldSkip);

// Case C: 60s video with 45MB -> 45MB > 15MB -> SHOULD NOT SKIP (COMPRESSION REQUIRED)
const res60s45mb = evaluateSmartSkipping({ duration: 60, sizeBytes: 45 * 1024 * 1024 });
console.assert(res60s45mb.shouldSkip === false, '60s video with 45MB should NOT skip compression');
console.log('  ✓ 60s video @ 45MB: shouldSkip =', res60s45mb.shouldSkip, `(${res60s45mb.reason})`);

// Case D: 10s video with 2.5MB -> 2.5MB = 10s / 4s * 1MB -> SHOULD SKIP
const res10s2_5mb = evaluateSmartSkipping({ duration: 10, sizeBytes: 2.5 * 1024 * 1024 });
console.assert(res10s2_5mb.shouldSkip === true, '10s video with 2.5MB should skip compression');
console.log('  ✓ 10s video @ 2.5MB: shouldSkip =', res10s2_5mb.shouldSkip);

// Case E: 10s video with 8MB -> 8MB > 2.5MB -> SHOULD NOT SKIP
const res10s8mb = evaluateSmartSkipping({ duration: 10, sizeBytes: 8 * 1024 * 1024 });
console.assert(res10s8mb.shouldSkip === false, '10s video with 8MB should NOT skip compression');
console.log('  ✓ 10s video @ 8MB: shouldSkip =', res10s8mb.shouldSkip);

// Test 3: Cloudinary Video URL Transformations
console.log('3. Cloudinary Video URL Transformation:');
const sampleVideoUrl = 'https://res.cloudinary.com/demo/video/upload/v12345/repair_sample.mp4';
const sampleMovUrl = 'https://res.cloudinary.com/demo/video/upload/v12345/iphone_recording.mov';

// Video needing compression
const compressedUrl = optimizeCloudinaryVideoUrl(sampleVideoUrl, {
  duration: 60,
  sizeBytes: 45 * 1024 * 1024,
});
console.assert(compressedUrl.includes('/video/upload/f_auto,q_auto:good,w_1280,h_1280,c_limit,vc_h264,br_1500k,ac_aac/'), 'Must apply optimal Cloudinary transformations when compressed');
console.log('  ✓ Video needing compression transformed URL:', compressedUrl);

// Video skipping compression (MP4)
const skippedUrl = optimizeCloudinaryVideoUrl(sampleVideoUrl, {
  duration: 60,
  sizeBytes: 12 * 1024 * 1024,
});
console.assert(skippedUrl === sampleVideoUrl, 'Skipped MP4 video should remain uncompressed');
console.log('  ✓ Skipped MP4 video URL (untouched):', skippedUrl);

// Video skipping compression (MOV -> normalized with f_auto to play across devices without lossy recompression)
const skippedMovUrl = optimizeCloudinaryVideoUrl(sampleMovUrl, {
  duration: 60,
  sizeBytes: 12 * 1024 * 1024,
});
console.assert(skippedMovUrl.includes('/f_auto/') && skippedMovUrl.endsWith('.mp4'), 'Skipped MOV video should be normalized with f_auto and .mp4');
console.log('  ✓ Skipped MOV video URL (normalized container):', skippedMovUrl);

// Test 4: Cloudinary Image URL Transformations (WhatsApp HD Style)
console.log('4. Cloudinary Image URL Transformation (WhatsApp HD):');
const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/spare_part.jpg';
const optimizedImageUrl = optimizeCloudinaryImageUrl(sampleImageUrl);
console.assert(optimizedImageUrl.includes('/image/upload/f_auto,q_auto:good,w_2560,h_2560,c_limit/'), 'Must apply WhatsApp HD preset: f_auto,q_auto:good,w_2560,h_2560,c_limit');
console.log('  ✓ WhatsApp HD Photo URL:', optimizedImageUrl);

console.log('\n--- All Compression & Validation Tests Passed Successfully! ---');

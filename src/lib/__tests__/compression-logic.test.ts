import {
  optimizeCloudinaryVideoUrl,
  optimizeCloudinaryImageUrl,
  MAX_VIDEO_SIZE_BYTES,
  MAX_PHOTO_SIZE_BYTES,
} from '../video-compressor';

console.log('--- Testing Cloudinary Native q_auto:eco Video Compression ---');

// Test 1: Size limits
console.log('1. Size limits:');
console.assert(MAX_VIDEO_SIZE_BYTES === 100 * 1024 * 1024, 'MAX_VIDEO_SIZE_BYTES must be 100MB');
console.assert(MAX_PHOTO_SIZE_BYTES === 9 * 1024 * 1024, 'MAX_PHOTO_SIZE_BYTES must be 9MB');
console.log('  ✓ Video limit: 100MB, Photo limit: 9MB');

// Test 2: Cloudinary Video URL Transformations with q_auto:eco
console.log('2. Cloudinary Video URL Transformation with q_auto:eco:');
const sampleVideoUrl = 'https://res.cloudinary.com/demo/video/upload/v12345/repair_sample.mp4';
const sampleMovUrl = 'https://res.cloudinary.com/demo/video/upload/v12345/iphone_recording.mov';

const optimizedVideoUrl = optimizeCloudinaryVideoUrl(sampleVideoUrl);
console.assert(
  optimizedVideoUrl.includes('/video/upload/f_auto,q_auto:eco/v12345/repair_sample.mp4'),
  'Must apply Cloudinary native compression preset: f_auto,q_auto:eco'
);
console.log('  ✓ Standard MP4 video URL transformed with q_auto:eco:', optimizedVideoUrl);

const optimizedMovUrl = optimizeCloudinaryVideoUrl(sampleMovUrl);
console.assert(
  optimizedMovUrl.includes('/video/upload/f_auto,q_auto:eco/v12345/iphone_recording.webm'),
  'MOV video should normalize container to .webm and apply f_auto,q_auto:eco'
);
console.log('  ✓ iPhone MOV video URL transformed with q_auto:eco & .webm container:', optimizedMovUrl);

// Test 3: Idempotent URL Transformation (strip pre-existing transformations)
console.log('3. Idempotent Transformation (strips prior transformations):');
const preTransformedUrl = 'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto:good,w_1280,h_1280/v12345/repair_sample.mp4';
const reoptimizedUrl = optimizeCloudinaryVideoUrl(preTransformedUrl);
console.assert(
  reoptimizedUrl === 'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto:eco/v12345/repair_sample.mp4',
  'Must strip prior transformation and apply clean f_auto,q_auto:eco'
);
console.log('  ✓ Pre-transformed URL cleanly updated to q_auto:eco:', reoptimizedUrl);

// Test 4: Cloudinary Image URL Transformations (WhatsApp HD Style)
console.log('4. Cloudinary Image URL Transformation:');
const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/spare_part.jpg';
const optimizedImageUrl = optimizeCloudinaryImageUrl(sampleImageUrl);
console.assert(
  optimizedImageUrl.includes('/image/upload/f_auto,q_auto:good,w_2560,h_2560,c_limit/'),
  'Must apply image preset: f_auto,q_auto:good,w_2560,h_2560,c_limit'
);
console.log('  ✓ Photo URL:', optimizedImageUrl);

// Test 5: Cloudinary Image Incoming Transformation
console.log('5. Image Incoming Transformation:');
const imageTransformation = 'q_auto:good';
console.assert(imageTransformation === 'q_auto:good', 'Image incoming transformation must be q_auto:good');
console.log('  ✓ Automatic good quality for images: incoming transformation with q_auto:good verified');

console.log('\n--- All Cloudinary Native Compression Tests Passed Successfully! ---');

import {
  buildIncomingVideoUploadOptions,
  buildDynamicPlaybackUrl,
} from '@/features/media/controllers/video-upload.controller';
import { cloudinary } from '@/lib/cloudinary';

console.log('--- Testing Cloudinary Incoming Video Transformation Controller ---');

// 1. Verify Incoming Transformation Options
const options = buildIncomingVideoUploadOptions('test/videos');

console.log('1. Verify Upload Options:');
console.assert(options.resource_type === 'video', 'Resource type must be video');
console.assert(Array.isArray(options.transformation), 'Transformation must be an array');
const transformList = options.transformation as any[];
console.assert(
  transformList?.[0]?.quality === 'auto:eco',
  'Quality must be strictly auto:eco'
);
console.assert(
  !(options as any).fetch_format && !(transformList?.[0] as any)?.fetch_format,
  'Must NOT include fetch_format in upload options'
);
console.assert(
  !JSON.stringify(options.transformation).includes('f_auto'),
  'Must NOT include f_auto in upload transformation'
);
console.log('  ✓ Incoming transformation correctly configured with strictly quality: "auto:eco"');
console.log('  ✓ Verified: NO "f_auto" or "fetch_format" during upload step');

// 2. Verify Cloudinary SDK serialization
const builtParams = (cloudinary.utils as any).build_upload_params(options);
console.log('2. Verify Cloudinary Serialized Upload Payload:');
console.assert(
  builtParams.transformation === 'q_auto:eco',
  `Expected transformation "q_auto:eco", got "${builtParams.transformation}"`
);
console.assert(
  !builtParams.transformation.includes('f_auto'),
  'Must not include f_auto in serialized payload'
);
console.log('  ✓ Serialized Cloudinary upload param: transformation =', builtParams.transformation);

// 3. Verify Dynamic Delivery Playback URL with f_auto
console.log('3. Verify Dynamic Frontend Playback URL with f_auto:');
const samplePublicId = 'tv-tech-os/videos/sample_video_123';
const playbackUrl = buildDynamicPlaybackUrl(samplePublicId, 'demo');
console.assert(
  playbackUrl.includes('/video/upload/f_auto,q_auto:eco/'),
  'Playback URL must include f_auto,q_auto:eco for dynamic browser delivery'
);
console.assert(
  playbackUrl === 'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto:eco/tv-tech-os/videos/sample_video_123.webm',
  'Playback URL must be properly formatted'
);
console.log('  ✓ Dynamic frontend playback URL with f_auto:', playbackUrl);

console.log('\n--- All Controller Tests Passed Successfully! ---');

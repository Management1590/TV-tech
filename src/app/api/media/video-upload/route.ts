import { NextRequest } from 'next/server';
import { handleVideoUpload } from '@/features/media/controllers/video-upload.controller';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration for video processing

/**
 * POST /api/media/video-upload
 *
 * Uploads a video directly to Cloudinary with an Incoming Transformation of `quality: "auto:eco"`.
 * Cloudinary compresses the video upon arrival and automatically discards the original master file.
 */
export async function POST(req: NextRequest) {
  return handleVideoUpload(req);
}

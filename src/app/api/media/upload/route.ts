import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { cloudinary } from '@/lib/cloudinary';
import { createMediaAttachment } from '@/features/media/services/media.service';
import { MediaType, StorageProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration for large video uploads

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const entityId = formData.get('entityId') as string | null;
    const purpose = (formData.get('purpose') as string) || 'GALLERY';

    if (!file || !entityId) {
      return NextResponse.json({ success: false, error: 'Missing file or target entity ID.' }, { status: 400 });
    }

    const mimeType = file.type.toLowerCase();
    const size = file.size;

    let mediaType: MediaType;
    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image';

    if (mimeType.startsWith('image/')) {
      mediaType = MediaType.IMAGE;
      resourceType = 'image';
    } else if (mimeType.startsWith('video/')) {
      if (size > MAX_VIDEO_SIZE) {
        return NextResponse.json({ success: false, error: 'Video size exceeds maximum 500MB limit.' }, { status: 400 });
      }
      mediaType = MediaType.VIDEO;
      resourceType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      if (size > MAX_AUDIO_SIZE) {
        return NextResponse.json({ success: false, error: 'Audio size exceeds maximum 100MB limit.' }, { status: 400 });
      }
      mediaType = MediaType.AUDIO;
      resourceType = 'video'; // Cloudinary processes audio under video resource_type
    } else {
      mediaType = MediaType.IMAGE;
      resourceType = 'auto';
    }

    // Convert file to Buffer for streaming upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream upload directly to Cloudinary
    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `tv-tech-os/${mediaType.toLowerCase()}s`,
          resource_type: resourceType,
          timeout: 300000, // 5 minutes timeout for large files
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // If purpose is PRIMARY, demote previous PRIMARY for this entity
    if (purpose === 'PRIMARY') {
      await prisma.entityMedia.updateMany({
        where: { entityId, purpose: 'PRIMARY' },
        data: { purpose: 'GALLERY' },
      });
    }

    // Register in database
    const media = await createMediaAttachment({
      entityId,
      mediaType,
      url: uploadResult.url,
      secureUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      provider: StorageProvider.CLOUDINARY,
      filename: file.name,
      mimeType: mimeType || `${mediaType.toLowerCase()}/unknown`,
      sizeBytes: size,
      width: uploadResult.width || undefined,
      height: uploadResult.height || undefined,
      purpose,
      uploadedById: user.id,
    });

    revalidatePath('/knowledge-base');
    revalidatePath('/inventory');

    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    console.error('Media upload API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to upload media.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { createMediaAttachment } from '@/features/media/services/media.service';
import { MediaType, StorageProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      entityId,
      mediaType,
      url,
      secureUrl,
      publicId,
      filename,
      mimeType,
      sizeBytes,
      width,
      height,
      purpose = 'GALLERY',
    } = body;

    if (!entityId || !url || !publicId) {
      return NextResponse.json({ success: false, error: 'Missing required media details.' }, { status: 400 });
    }

    // If purpose is PRIMARY, demote previous PRIMARY for this entity
    if (purpose === 'PRIMARY') {
      await prisma.entityMedia.updateMany({
        where: { entityId, purpose: 'PRIMARY' },
        data: { purpose: 'GALLERY' },
      });
    }

    const resolvedMediaType = mediaType === 'VIDEO'
      ? MediaType.VIDEO
      : mediaType === 'AUDIO'
      ? MediaType.AUDIO
      : MediaType.IMAGE;

    const media = await createMediaAttachment({
      entityId,
      mediaType: resolvedMediaType,
      provider: StorageProvider.CLOUDINARY,
      publicId,
      url,
      secureUrl: secureUrl || url,
      filename: filename || 'media_upload',
      mimeType: mimeType || (resolvedMediaType === MediaType.VIDEO ? 'video/mp4' : 'image/jpeg'),
      sizeBytes: sizeBytes || undefined,
      width: width || undefined,
      height: height || undefined,
      purpose,
      uploadedById: user.id,
    });

    revalidatePath('/knowledge-base');
    revalidatePath('/inventory');
    revalidatePath(`/inventory/items/${entityId}`);

    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    console.error('Media register error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to register media asset' }, { status: 500 });
  }
}

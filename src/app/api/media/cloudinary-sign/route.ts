import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { cloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const resourceType = body.resourceType || 'video'; // 'video' | 'image' | 'auto'
    const folder = body.folder || `tv-tech-os/${resourceType === 'video' ? 'videos' : resourceType === 'image' ? 'images' : 'media'}`;

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, any> = {
      folder,
      timestamp,
    };

    const fileSize = Number(body.fileSize) || 0;
    const isLargeForSync = fileSize > 40 * 1024 * 1024 || Boolean(body.useEagerAsync);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
    const hasPublicUrl = appUrl.startsWith('https://');

    // Video optimization strategy:
    // 1. Files <= 40MB use Incoming Transformation with `format: 'webm'` and `q_auto:eco`.
    //    This automatically converts MOV/MP4 to WebM and aggressively compresses it,
    //    preventing files from sticking to heavy .mov containers and discarding master files at rest.
    // 2. Files > 40MB exceed Cloudinary's synchronous processing threshold (which throws "Video is too large
    //    to process synchronously"), so they are signed with `eager: 'f_webm,q_auto:eco'` and `eager_async: true`.
    if (resourceType === 'video') {
      if (isLargeForSync) {
        paramsToSign.eager = 'f_webm,q_auto:eco';
        paramsToSign.eager_async = true;
        if (hasPublicUrl) {
          paramsToSign.notification_url = `${appUrl}/api/media/cloudinary-webhook`;
        }
      } else {
        paramsToSign.format = 'webm';
        paramsToSign.transformation = 'q_auto:eco';
      }
    } else if (resourceType === 'image') {
      // Automatic good quality for images: incoming transformation with q_auto:good.
      // This automatically compresses the image before storing it, discarding the heavy master at rest.
      paramsToSign.transformation = 'q_auto:good';
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || 'm1wDvL1NC5LNvGNeg6eFyOyanMI'
    );

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY || '918732292732855',
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'zcquougv',
      folder,
      format: paramsToSign.format,
      transformation: paramsToSign.transformation,
      eager: paramsToSign.eager,
      eager_async: paramsToSign.eager_async,
      notification_url: paramsToSign.notification_url,
    });
  } catch (error: any) {
    console.error('Cloudinary sign error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Signing failed' }, { status: 500 });
  }
}

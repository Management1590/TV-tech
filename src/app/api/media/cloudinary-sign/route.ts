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
    });
  } catch (error: any) {
    console.error('Cloudinary sign error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Signing failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  checkOrPromoteMaster,
  awaitAndPromoteMaster,
  syncAllHeavyVideos,
} from '@/lib/cloudinary-optimize-master';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { publicId, derivedUrl, mediaId, mode, syncAll } = body;

    // 1. Batch sync all heavy videos in database
    if (syncAll) {
      const syncResult = await syncAllHeavyVideos();
      return NextResponse.json({
        success: true,
        status: 'sync_completed',
        ...syncResult,
      });
    }

    if (!publicId) {
      return NextResponse.json({ success: false, error: 'Missing publicId' }, { status: 400 });
    }

    // 2. Server-side long-polling mode (up to 50s)
    if (mode === 'await') {
      const result = await awaitAndPromoteMaster(publicId, derivedUrl, 50000, 2500, mediaId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || 'Promotion timed out' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        status: 'completed',
        bytes: result.bytes,
        format: result.format,
        url: result.url,
        secureUrl: result.secureUrl,
      });
    }

    // 3. Fast non-blocking check (~200ms) for client-orchestrated polling
    const checkResult = await checkOrPromoteMaster(publicId, derivedUrl, mediaId);

    if (checkResult.status === 'error') {
      return NextResponse.json({
        success: false,
        status: 'error',
        error: checkResult.error || 'Promotion check failed',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status: checkResult.status,
      bytes: checkResult.bytes,
      format: checkResult.format,
      url: checkResult.url,
      secureUrl: checkResult.secureUrl,
      message: checkResult.message,
    });
  } catch (error: any) {
    console.error('[API promote-master error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Promotion failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const publicId = searchParams.get('publicId');
    const syncAll = searchParams.get('syncAll') === 'true';

    if (syncAll) {
      const syncResult = await syncAllHeavyVideos();
      return NextResponse.json({ success: true, status: 'sync_completed', ...syncResult });
    }

    if (!publicId) {
      return NextResponse.json({ success: false, error: 'Missing publicId parameter' }, { status: 400 });
    }

    const checkResult = await checkOrPromoteMaster(publicId);
    return NextResponse.json({ ...checkResult });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}


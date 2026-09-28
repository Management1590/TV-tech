import { NextRequest, NextResponse } from 'next/server';
import { executeMasterPromotion } from '@/lib/cloudinary-optimize-master';

export const dynamic = 'force-dynamic';

/**
 * Cloudinary Eager Transformation Notification Webhook
 * When large videos finish asynchronous eager transcoding in the cloud,
 * Cloudinary automatically notifies this endpoint.
 * This ensures master promotion runs even if the user closed their browser tab.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { notification_type, public_id, eager } = body;

    console.log(`[Cloudinary Webhook] Received notification: ${notification_type} for ${public_id}`);

    if (notification_type === 'eager' && public_id && Array.isArray(eager)) {
      const webmEager = eager.find(
        (e: any) =>
          (e.format === 'webm' || e.url?.includes('f_webm') || e.secure_url?.includes('.webm')) &&
          Number(e.bytes) > 0
      );

      if (webmEager && (webmEager.secure_url || webmEager.url)) {
        const derivedUrl = webmEager.secure_url || webmEager.url;
        console.log(`[Cloudinary Webhook] Executing master overwrite for ${public_id} with ${derivedUrl}...`);
        await executeMasterPromotion(public_id, derivedUrl);
        return NextResponse.json({ success: true, message: 'Master overwritten to WebM' });
      }
    }

    return NextResponse.json({ success: true, message: 'Notification received' });
  } catch (err: any) {
    console.error('[Cloudinary Webhook Error]:', err?.message);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

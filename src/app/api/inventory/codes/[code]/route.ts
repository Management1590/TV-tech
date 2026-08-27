import { NextRequest, NextResponse } from 'next/server';
import { getSupplierRecordByShortCode } from '@/features/inventory/services/supplier-record.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const record = await getSupplierRecordByShortCode(code);

    if (!record) {
      return NextResponse.json(
        { success: false, error: `Short code #${code.toUpperCase()} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Lookup failed' },
      { status: 500 }
    );
  }
}

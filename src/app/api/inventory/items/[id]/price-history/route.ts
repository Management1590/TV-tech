import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { subDays, subMonths, subYears } from 'date-fns';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get('period') || 'all';

    let dateFilter = undefined;
    const now = new Date();
    
    if (period === '7d') {
      dateFilter = { gte: subDays(now, 7) };
    } else if (period === '30d') {
      dateFilter = { gte: subDays(now, 30) };
    } else if (period === '3m') {
      dateFilter = { gte: subMonths(now, 3) };
    } else if (period === '6m') {
      dateFilter = { gte: subMonths(now, 6) };
    } else if (period === '1y') {
      dateFilter = { gte: subYears(now, 1) };
    }

    const where: any = { itemId };
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    const records = await prisma.supplierRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        costPrice: true,
        sellingPrice: true,
        supplierName: true,
        shortCode: true,
        purchaseDate: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      records: records.map((r) => ({
        id: r.id,
        costPrice: r.costPrice ? Number(r.costPrice) : null,
        sellingPrice: r.sellingPrice ? Number(r.sellingPrice) : null,
        supplierName: r.supplierName,
        shortCode: r.shortCode,
        createdAt: (r.purchaseDate || r.createdAt).toISOString(),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch price history', records: [] },
      { status: 500 }
    );
  }
}

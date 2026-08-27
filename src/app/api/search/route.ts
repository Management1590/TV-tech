import { NextRequest, NextResponse } from 'next/server';
import { universalSearch, searchKnowledgeBase } from '@/features/search/services/search.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const scope = searchParams.get('scope') || 'all'; // 'all' | 'brands' | 'models' | 'kb'
    const brandId = searchParams.get('brandId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    // 1. Strict Brand-Only search (when in Knowledge Base root)
    if (scope === 'brands') {
      const results = await searchKnowledgeBase({
        query,
        scope: 'brands',
        limit,
      });
      return NextResponse.json({ success: true, results });
    }

    // 2. Strict Model-Only search (when inside a Brand or Model)
    if (scope === 'models') {
      const results = await searchKnowledgeBase({
        query,
        scope: 'models',
        brandId,
        limit,
      });
      return NextResponse.json({ success: true, results });
    }

    // 3. Knowledge Base general search (Brands + Models only)
    if (scope === 'kb') {
      const [brands, models] = await Promise.all([
        searchKnowledgeBase({ query, scope: 'brands', limit }),
        searchKnowledgeBase({ query, scope: 'models', brandId, limit }),
      ]);
      const combined = [...brands, ...models].sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
      return NextResponse.json({ success: true, results: combined });
    }

    // 4. Universal search (Inventory items, folders, etc.)
    const grouped = await universalSearch(query, limit);

    const sortedItems = [...grouped.items].sort((a, b) => b.matchScore - a.matchScore);
    const sortedFolders = [...grouped.folders].sort((a, b) => b.matchScore - a.matchScore);
    const sortedTvBrands = [...(grouped.tvBrands || [])].sort((a, b) => b.matchScore - a.matchScore);
    const sortedTvModels = [...(grouped.tvModels || [])].sort((a, b) => b.matchScore - a.matchScore);
    const sortedSuppliers = [...grouped.suppliers].sort((a, b) => b.matchScore - a.matchScore);

    const resultsList = [
      ...sortedItems,
      ...sortedFolders,
      ...sortedTvBrands,
      ...sortedTvModels,
      ...sortedSuppliers,
    ];

    const results = resultsList
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        entityType: r.entityType,
        title: r.title,
        subtitle: r.subtitle,
        entityId: r.id,
        thumbnailUrl: r.thumbnailUrl,
        linkUrl: r.linkUrl,
        shortCode: r.shortCode,
        score: r.matchScore,
      }));

    return NextResponse.json({ success: true, data: grouped, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Search failed', results: [] },
      { status: 500 }
    );
  }
}

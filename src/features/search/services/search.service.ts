// ============================================================
// Universal Search Service (Alphanumeric-Normalized Ordered Subsequence Match)
// ============================================================
// Implements sequence matching agnostic to spaces and special characters.
// Example:
//  - "samsung backlight 1" matches "ssung", "ungback", "smuback"
//  - "samsung backlight 1" does NOT match "backsamsu", "1back"
//  - "4-3-32" matches "4332", "332", "4 3 32", "4/3/32"

import { prisma } from '@/lib/prisma';

export interface SearchResultItem {
  id: string; // Entity ID / Item ID
  entityType: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  shortCode?: string;
  linkUrl: string;
  matchScore: number;
}

export interface GroupedSearchResults {
  query: string;
  items: SearchResultItem[];
  folders: SearchResultItem[];
  suppliers: SearchResultItem[];
  tvModels: SearchResultItem[];
  tvBrands: SearchResultItem[];
  kbFolders: SearchResultItem[];
  totalMatches: number;
}

/**
 * Normalizes text for search by converting to lowercase and stripping all non-alphanumeric characters.
 * Spaces, hyphens, slashes, periods, etc. are completely ignored.
 */
export function normalizeSearchString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if query appears as an ordered sequence in target (left-to-right, index strictly increasing).
 * Both query and target are normalized to alphanumeric characters only.
 *
 * Example 1: Target = "samsung backlight 1" (norm: "samsungbacklight1")
 *  - "ssung"     -> TRUE
 *  - "ungback"   -> TRUE
 *  - "smuback"   -> TRUE
 *  - "backsamsu" -> FALSE
 *  - "1back"     -> FALSE
 *
 * Example 2: Target = "4-3-32" (norm: "4332")
 *  - "4332"      -> TRUE
 *  - "332"       -> TRUE
 *  - "4 3 32"    -> TRUE
 *  - "4/3/32"    -> TRUE
 */
export function matchesOrderedPattern(query: string, target: string): boolean {
  const q = normalizeSearchString(query);
  const t = normalizeSearchString(target);

  if (!q || !t) return false;
  if (q.length > t.length) return false;

  let qIdx = 0;
  for (let tIdx = 0; tIdx < t.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      qIdx++;
      if (qIdx === q.length) return true; // All query characters found in sequence
    }
  }

  return false;
}

/**
 * Computes relevance score for ranking search results.
 * Higher score = higher ranking in search output.
 */
export function calculateMatchScore(query: string, text: string, shortCode?: string): number {
  const cleanQ = query.trim();
  const qNorm = normalizeSearchString(cleanQ);
  const tNorm = normalizeSearchString(text);

  if (!qNorm || !tNorm) return 0;

  // 1. Exact short code match (#FK5Y or FK5Y)
  const is4DigitQuery = qNorm.length === 4;
  if (shortCode) {
    const scNorm = normalizeSearchString(shortCode);
    if (scNorm && (scNorm === qNorm || shortCode.toUpperCase() === cleanQ.replace(/^#/, '').toUpperCase())) {
      return is4DigitQuery ? 15000 : 12000;
    }
    if (is4DigitQuery && matchesOrderedPattern(cleanQ, shortCode)) {
      return 10000;
    }
  }

  // 2. Exact standalone match: Text alone equals query (e.g. folder "LG", brand "LG")
  if (tNorm === qNorm) {
    return 10000;
  }

  // 3. Isolated Word Token match: Target text contains query as a distinct separate word (e.g. "LG 55 Inch", "LG OLED", "Samsung LG")
  const words = text.toLowerCase().split(/[\s\-_/.,+()]+/);
  const hasExactWord = words.some((w) => normalizeSearchString(w) === qNorm);
  if (hasExactWord) {
    return 7000;
  }

  // 4. Normalized prefix match: Text starts with query (e.g. "LG43UN7100")
  if (tNorm.startsWith(qNorm)) {
    return 5000;
  }

  // 5. Normalized contiguous substring match: (e.g. "bdlgsn" or "samsung_lg_item")
  if (tNorm.includes(qNorm)) {
    return 3000;
  }

  // 6. Ordered subsequence match: (e.g. "backLiGht" where 'l' and 'g' appear separated left-to-right)
  if (matchesOrderedPattern(cleanQ, text)) {
    // Calculate compactness: distance between first and last matched char in target
    let firstIdx = -1;
    let lastIdx = -1;
    let qIdx = 0;
    for (let tIdx = 0; tIdx < tNorm.length; tIdx++) {
      if (tNorm[tIdx] === qNorm[qIdx]) {
        if (firstIdx === -1) firstIdx = tIdx;
        qIdx++;
        if (qIdx === qNorm.length) {
          lastIdx = tIdx;
          break;
        }
      }
    }
    const span = lastIdx - firstIdx + 1;
    const compactnessBonus = Math.max(0, Math.round(50 * (qNorm.length / span)));
    return 400 + compactnessBonus;
  }

  // 7. Backward sequences (e.g. "gl" on "lg") or missing letters -> 0 (rejected)
  return 0;
}

/**
 * Universal Search across all registered entity types with sequence matching.
 */
export async function universalSearch(query: string, limit: number = 50): Promise<GroupedSearchResults> {
  const cleanQuery = query.trim();
  const qNorm = normalizeSearchString(cleanQuery);

  if (!cleanQuery || !qNorm) {
    return { query, items: [], folders: [], suppliers: [], tvModels: [], tvBrands: [], kbFolders: [], totalMatches: 0 };
  }

  const is4DigitQuery = qNorm.length === 4;

  // Direct 4-digit Short Code Priority Lookup
  let directCodeMatches: SearchResultItem[] = [];
  if (is4DigitQuery) {
    const codeRecords = await prisma.supplierRecord.findMany({
      where: {
        shortCode: { equals: qNorm.toUpperCase(), mode: 'insensitive' },
      },
      include: {
        item: true,
        supplier: true,
      },
    });

    for (const record of codeRecords) {
      directCodeMatches.push({
        id: record.itemId,
        entityType: 'ITEM',
        title: record.item.name,
        subtitle: `Code Match: #${record.shortCode} • ${record.supplierName || record.supplier?.name || 'Supplier'} ${record.sellingPrice ? `• ₹${record.sellingPrice}` : ''}`,
        shortCode: record.shortCode,
        linkUrl: `/inventory/items/${record.itemId}`,
        matchScore: 20000, // Absolute top priority
      });
    }
  }

  // Fetch search candidates from all entity tables (no artificial 100 limit on folders/brands)
  const [folders, tvBrands, tvModels, items, kbFolders, suppliers, indexEntries] = await Promise.all([
    prisma.folder.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        materializedPath: true,
        thumbnailUrl: true,
      },
    }),
    prisma.tvBrand.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        _count: { select: { models: true } },
      },
    }),
    prisma.tvModel.findMany({
      take: 500,
      select: {
        id: true,
        modelNumber: true,
        chassisNo: true,
        displayType: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.item.findMany({
      take: 500,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        location: true,
        notes: true,
        entity: {
          include: {
            mediaAttachments: {
              include: { media: true },
              orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'desc' },
              ],
            },
          },
        },
        supplierRecords: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { shortCode: true, supplierName: true, sellingPrice: true },
        },
      },
    }),
    prisma.knowledgeFolder.findMany({
      take: 200,
      select: {
        id: true,
        name: true,
        modelId: true,
        model: {
          select: {
            modelNumber: true,
            brand: { select: { name: true } },
          },
        },
      },
    }),
    prisma.supplier.findMany({
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
      },
    }),
    prisma.searchIndex.findMany({
      take: 500,
      select: {
        id: true,
        entityId: true,
        entityType: true,
        title: true,
        subtitle: true,
        shortCode: true,
        searchText: true,
      },
    }),
  ]);

  const scoredResults: SearchResultItem[] = [];
  const seenEntityKeys = new Set<string>();

  // Add direct code matches first
  for (const direct of directCodeMatches) {
    const key = `ITEM_${direct.id}`;
    if (!seenEntityKeys.has(key)) {
      seenEntityKeys.add(key);
      scoredResults.push(direct);
    }
  }

  // 1. Process Folders directly (with exact title priority)
  for (const folder of folders) {
    const nameScore = calculateMatchScore(cleanQuery, folder.name);
    const descScore = folder.description ? calculateMatchScore(cleanQuery, folder.description) : 0;
    const score = Math.max(nameScore, descScore);
    if (score > 0) {
      const key = `FOLDER_${folder.id}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);
        scoredResults.push({
          id: folder.id,
          entityType: 'FOLDER',
          title: folder.name,
          subtitle: folder.description || undefined,
          thumbnailUrl: folder.thumbnailUrl || null,
          linkUrl: `/inventory/folders/${folder.materializedPath}`,
          matchScore: score,
        });
      }
    }
  }

  // 2. Process TV Brands directly (with exact title priority)
  for (const brand of tvBrands) {
    const nameScore = calculateMatchScore(cleanQuery, brand.name);
    const descScore = brand.description ? calculateMatchScore(cleanQuery, brand.description) : 0;
    const score = Math.max(nameScore, descScore);
    if (score > 0) {
      const key = `TV_BRAND_${brand.id}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);
        scoredResults.push({
          id: brand.id,
          entityType: 'TV_BRAND',
          title: brand.name,
          subtitle: `${brand._count.models} ${brand._count.models === 1 ? 'Model' : 'Models'}${brand.description ? ' • ' + brand.description : ''}`,
          thumbnailUrl: brand.logoUrl || null,
          linkUrl: `/knowledge-base/brands/${brand.id}`,
          matchScore: score,
        });
      }
    }
  }

  // 3. Process TV Models directly
  for (const tv of tvModels) {
    const modelScore = calculateMatchScore(cleanQuery, tv.modelNumber);
    const brandModelScore = calculateMatchScore(cleanQuery, `${tv.brand.name} ${tv.modelNumber}`);
    const chassisScore = tv.chassisNo ? calculateMatchScore(cleanQuery, tv.chassisNo) : 0;
    const score = Math.max(modelScore, brandModelScore, chassisScore);
    if (score > 0) {
      const key = `TV_MODEL_${tv.id}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);
        scoredResults.push({
          id: tv.id,
          entityType: 'TV_MODEL',
          title: `${tv.brand.name} ${tv.modelNumber}`,
          subtitle: tv.chassisNo ? `Chassis: ${tv.chassisNo}` : tv.displayType ? `Type: ${tv.displayType}` : undefined,
          linkUrl: `/knowledge-base/models/${tv.id}`,
          matchScore: score,
        });
      }
    }
  }

  // 4. Process Items directly
  for (const item of items) {
    let highestItemScore = calculateMatchScore(cleanQuery, item.name);
    let matchedShortCode = item.supplierRecords[0]?.shortCode || undefined;

    for (const sr of item.supplierRecords) {
      const scScore = calculateMatchScore(cleanQuery, sr.shortCode, sr.shortCode);
      if (scScore > highestItemScore) {
        highestItemScore = scScore;
        matchedShortCode = sr.shortCode;
      }
      const combined = [item.name, item.location, item.notes, sr.shortCode, sr.supplierName].filter(Boolean).join(' ');
      const s = calculateMatchScore(cleanQuery, combined, sr.shortCode);
      if (s > highestItemScore) {
        highestItemScore = s;
        matchedShortCode = sr.shortCode;
      }
    }

    if (highestItemScore > 0) {
      const key = `ITEM_${item.id}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);
        const primaryAttachment =
          item.entity?.mediaAttachments?.find((a: any) => a.purpose === 'PRIMARY') ||
          item.entity?.mediaAttachments?.[0];
        const thumbnailUrl =
          primaryAttachment?.media?.secureUrl || primaryAttachment?.media?.url || null;

        scoredResults.push({
          id: item.id,
          entityType: 'ITEM',
          title: item.name,
          subtitle: item.location ? `Bin: ${item.location}` : undefined,
          shortCode: matchedShortCode,
          thumbnailUrl,
          linkUrl: `/inventory/items/${item.id}`,
          matchScore: highestItemScore,
        });
      }
    }
  }

  // 5. Process Knowledge Folders directly
  for (const kf of kbFolders) {
    if (!kf.model) continue;
    const nameScore = calculateMatchScore(cleanQuery, kf.name);
    const combinedScore = calculateMatchScore(cleanQuery, `${kf.model.brand.name} ${kf.model.modelNumber} ${kf.name}`);
    const score = Math.max(nameScore, combinedScore);
    if (score > 0) {
      const key = `KB_FOLDER_${kf.id}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);
        scoredResults.push({
          id: kf.id,
          entityType: 'KB_FOLDER',
          title: kf.name,
          subtitle: `${kf.model.brand.name} ${kf.model.modelNumber} • Technical Folder`,
          linkUrl: `/knowledge-base/models/${kf.modelId}/folders/${kf.id}`,
          matchScore: score,
        });
      }
    }
  }

  // 6. Process Suppliers directly
  for (const sup of suppliers) {
    const combinedText = [sup.name, sup.phone, sup.address].filter(Boolean).join(' ');
    const score = calculateMatchScore(cleanQuery, combinedText);
    if (score > 0) {
      const key = `SUPPLIER_${sup.id}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);
        scoredResults.push({
          id: sup.id,
          entityType: 'SUPPLIER',
          title: sup.name,
          subtitle: sup.phone ? `Phone: ${sup.phone}` : undefined,
          linkUrl: `/inventory`,
          matchScore: score,
        });
      }
    }
  }

  // 7. Process remaining Search Index entries for extra coverage
  for (const entry of indexEntries) {
    const score = calculateMatchScore(cleanQuery, entry.searchText, entry.shortCode || undefined);
    if (score > 0) {
      const key = `${entry.entityType}_${entry.entityId}`;
      if (!seenEntityKeys.has(key)) {
        seenEntityKeys.add(key);

        let linkUrl = `/inventory/items/${entry.entityId}`;
        if (entry.entityType === 'FOLDER') linkUrl = `/inventory/folders/${entry.entityId}`;
        if (entry.entityType === 'SUPPLIER') linkUrl = `/inventory`;
        if (entry.entityType === 'TV_MODEL') linkUrl = `/knowledge-base/models/${entry.entityId}`;
        if (entry.entityType === 'TV_BRAND') linkUrl = `/knowledge-base/brands/${entry.entityId}`;

        scoredResults.push({
          id: entry.entityId,
          entityType: entry.entityType,
          title: entry.title,
          subtitle: entry.subtitle || undefined,
          shortCode: entry.shortCode || undefined,
          linkUrl,
          matchScore: score,
        });
      }
    }
  }

  // Sort descending by match score
  scoredResults.sort((a, b) => b.matchScore - a.matchScore);

  const grouped: GroupedSearchResults = {
    query: cleanQuery,
    items: scoredResults.filter((r) => r.entityType === 'ITEM').slice(0, limit),
    folders: scoredResults.filter((r) => r.entityType === 'FOLDER').slice(0, limit),
    suppliers: scoredResults.filter((r) => r.entityType === 'SUPPLIER').slice(0, limit),
    tvModels: scoredResults.filter((r) => r.entityType === 'TV_MODEL').slice(0, limit),
    tvBrands: scoredResults.filter((r) => r.entityType === 'TV_BRAND').slice(0, limit),
    kbFolders: scoredResults.filter((r) => r.entityType === 'KB_FOLDER').slice(0, limit),
    totalMatches: scoredResults.length,
  };

  return grouped;
}

/**
 * Context-Scoped Knowledge Base Search
 * Strictly searches TV Brands or TV Models according to the current directory scope.
 */
export async function searchKnowledgeBase(params: {
  query: string;
  scope?: 'brands' | 'models';
  brandId?: string;
  limit?: number;
}): Promise<SearchResultItem[]> {
  const cleanQ = params.query.trim();
  if (!cleanQ) return [];

  const limit = params.limit || 25;

  if (params.scope === 'brands') {
    const brands = await prisma.tvBrand.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        _count: { select: { models: true } },
      },
    });

    const scored: SearchResultItem[] = brands
      .map((b) => {
        const combined = [b.name, b.description].filter(Boolean).join(' ');
        const score = calculateMatchScore(cleanQ, combined);
        return {
          id: b.id,
          entityType: 'TV_BRAND',
          title: b.name,
          subtitle: `${b._count.models} ${b._count.models === 1 ? 'Model' : 'Models'}${b.description ? ' • ' + b.description : ''}`,
          thumbnailUrl: b.logoUrl,
          linkUrl: `/knowledge-base/brands/${b.id}`,
          matchScore: score,
        };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return scored;
  }

  if (params.scope === 'models') {
    const whereClause: any = {};
    if (params.brandId) {
      whereClause.brandId = params.brandId;
    }

    const models = await prisma.tvModel.findMany({
      where: whereClause,
      select: {
        id: true,
        modelNumber: true,
        chassisNo: true,
        displayType: true,
        screenSize: true,
        notes: true,
        brand: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { knowledgeFolders: true } },
      },
    });

    const scored: SearchResultItem[] = models
      .map((m) => {
        const combined = [
          m.modelNumber,
          m.brand.name,
          m.chassisNo || '',
          m.displayType || '',
          m.screenSize ? `${m.screenSize} inch` : '',
          m.notes || '',
        ].join(' ');

        const score = calculateMatchScore(cleanQ, combined);
        const specs = [
          m.screenSize ? `${m.screenSize}"` : null,
          m.displayType,
          m.chassisNo ? `Chassis: ${m.chassisNo}` : null,
          `${m._count.knowledgeFolders} Folders`,
        ].filter(Boolean).join(' • ');

        return {
          id: m.id,
          entityType: 'TV_MODEL',
          title: params.brandId ? m.modelNumber : `${m.brand.name} ${m.modelNumber}`,
          subtitle: specs || m.notes || undefined,
          thumbnailUrl: m.brand.logoUrl,
          linkUrl: `/knowledge-base/models/${m.id}`,
          matchScore: score,
        };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return scored;
  }

  return [];
}

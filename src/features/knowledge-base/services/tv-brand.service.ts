// ============================================================
// TV Brand Domain Service
// ============================================================
// Manages TV Manufacturer Brands (LG, Samsung, Sony, MI, TCL, Panasonic, etc.)
// Registers in Universal Entity Registry (`entityTypeCode: 'TV_BRAND'`).

import { prisma } from '@/lib/prisma';
import { TvBrand } from '@prisma/client';
import { ensureEntityType } from '@/lib/ensure-entity-types';
import { validateNameSimilarity } from '@/features/knowledge-base/utils/name-similarity-validator';

export interface CreateTvBrandInput {
  name: string;
  logoUrl?: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-');
}

export async function createTvBrand(input: CreateTvBrandInput): Promise<TvBrand> {
  const cleanName = input.name.trim();
  const existingBrands = await prisma.tvBrand.findMany({ select: { name: true } });
  const collision = validateNameSimilarity(cleanName, existingBrands.map((b) => b.name), 'Brand');
  if (collision.hasConflict) {
    throw new Error(collision.message);
  }

  const slug = generateSlug(cleanName);

  return await prisma.$transaction(async (tx) => {
    await ensureEntityType('TV_BRAND', tx);
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'TV_BRAND',
        displayName: cleanName,
        searchText: cleanName,
      },
    });

    return await tx.tvBrand.create({
      data: {
        entityId: entity.id,
        name: cleanName,
        slug,
        logoUrl: input.logoUrl,
      },
    });
  }, { timeout: 25000, maxWait: 20000 });
}

export async function getAllTvBrands(): Promise<TvBrand[]> {
  return await prisma.tvBrand.findMany({
    orderBy: { name: 'asc' },
    include: {
      models: {
        select: { id: true, modelNumber: true, slug: true },
      },
    },
  });
}

export async function getTvBrandBySlug(slug: string) {
  return await prisma.tvBrand.findUnique({
    where: { slug },
    include: {
      models: {
        orderBy: { modelNumber: 'asc' },
      },
    },
  });
}

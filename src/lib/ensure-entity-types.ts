import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const SYSTEM_ENTITY_TYPES: Record<string, { label: string; description: string }> = {
  FOLDER: { label: 'Inventory Folder', description: 'Folder in inventory hierarchy' },
  ITEM: { label: 'Spare Part Item', description: 'Domain item entity for TV spare parts' },
  SUPPLIER: { label: 'Supplier Entity', description: 'Normalized supplier entity' },
  SUPPLIER_RECORD: { label: 'Price Record', description: 'Append-only supplier price record' },
  PURCHASE_LIST: { label: 'Purchase List', description: 'Purchase manager list' },
  TV_BRAND: { label: 'TV Brand', description: 'TV Manufacturer Brand' },
  TV_MODEL: { label: 'TV Model', description: 'TV Model record in KB' },
  KNOWLEDGE_FOLDER: { label: 'KB Folder', description: 'Knowledge base folder for TV model' },
  KNOWLEDGE_PAGE: { label: 'KB Page', description: 'Knowledge base page content' },
  MEDIA: { label: 'Media Attachment', description: 'Cloudinary/Supabase media asset' },
};

export const SYSTEM_RELATIONSHIP_TYPES: Record<
  string,
  {
    label: string;
    forwardLabel: string;
    reverseLabel: string;
    sourceEntityType: string;
    targetEntityType: string;
    description: string;
  }
> = {
  ITEM_COMPATIBLE_TV_MODEL: {
    label: 'Compatible TV Model',
    forwardLabel: 'Compatible with TV Model',
    reverseLabel: 'Compatible Spare Part',
    sourceEntityType: 'ITEM',
    targetEntityType: 'TV_MODEL',
    description: 'Links a spare part item to compatible TV models',
  },
  ITEM_ALTERNATIVE_ITEM: {
    label: 'Alternative Item',
    forwardLabel: 'Can be replaced by',
    reverseLabel: 'Can replace',
    sourceEntityType: 'ITEM',
    targetEntityType: 'ITEM',
    description: 'Links an item to alternative/substitute items',
  },
  PURCHASE_LIST_SUPPLIER: {
    label: 'Purchase List Supplier',
    forwardLabel: 'Targeted to Supplier',
    reverseLabel: 'Associated Purchase List',
    sourceEntityType: 'PURCHASE_LIST',
    targetEntityType: 'SUPPLIER',
    description: 'Links a purchase list to a specific supplier',
  },
};

/**
 * Returns Prisma connectOrCreate payload for EntityType relation.
 * Guarantees that Entity creation never fails even if database was completely wiped.
 */
export function getEntityTypeConnectOrCreate(code: string) {
  const def = SYSTEM_ENTITY_TYPES[code] || { label: code, description: `${code} Entity` };
  return {
    connectOrCreate: {
      where: { code },
      create: {
        code,
        label: def.label,
        description: def.description,
        isSystem: true,
      },
    },
  };
}

/**
 * Ensures that the required EntityType exists in the database.
 * Auto-creates it if missing to prevent foreign key errors.
 */
export async function ensureEntityType(code: string, tx?: Prisma.TransactionClient): Promise<void> {
  const client = tx || prisma;
  const def = SYSTEM_ENTITY_TYPES[code] || { label: code, description: `${code} Entity` };

  await client.entityType.upsert({
    where: { code },
    update: {},
    create: {
      code,
      label: def.label,
      description: def.description,
      isSystem: true,
    },
  });
}

/**
 * Ensures that all system EntityTypes exist in the database.
 */
export async function ensureAllSystemEntityTypes(tx?: Prisma.TransactionClient): Promise<void> {
  const client = tx || prisma;
  for (const [code, def] of Object.entries(SYSTEM_ENTITY_TYPES)) {
    await client.entityType.upsert({
      where: { code },
      update: {},
      create: {
        code,
        label: def.label,
        description: def.description,
        isSystem: true,
      },
    });
  }
}

/**
 * Ensures that all system RelationshipTypes exist in the database.
 */
export async function ensureRelationshipType(code: string, tx?: Prisma.TransactionClient): Promise<void> {
  const client = tx || prisma;
  const def = SYSTEM_RELATIONSHIP_TYPES[code];
  if (!def) return;

  await client.relationshipType.upsert({
    where: { code },
    update: {},
    create: {
      code,
      label: def.label,
      forwardLabel: def.forwardLabel,
      reverseLabel: def.reverseLabel,
      sourceEntityType: def.sourceEntityType,
      targetEntityType: def.targetEntityType,
      description: def.description,
      isSystem: true,
    },
  });
}

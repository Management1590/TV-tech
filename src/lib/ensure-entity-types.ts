import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const SYSTEM_ENTITY_TYPES: Record<string, { label: string; description: string }> = {
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

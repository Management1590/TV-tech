import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting TV Tech OS database seed...');

  // ------------------------------------------------------------
  // 1. System Entity Types
  // ------------------------------------------------------------
  const entityTypes = [
    { code: 'FOLDER', label: 'Inventory Folder', description: 'Folder in inventory hierarchy' },
    { code: 'ITEM', label: 'Spare Part Item', description: 'Domain item entity for TV spare parts' },
    { code: 'SUPPLIER', label: 'Supplier Entity', description: 'Normalized supplier entity' },
    { code: 'SUPPLIER_RECORD', label: 'Price Record', description: 'Append-only supplier price record' },
    { code: 'PURCHASE_LIST', label: 'Purchase List', description: 'Purchase manager list' },
    { code: 'TV_BRAND', label: 'TV Brand', description: 'TV Manufacturer Brand' },
    { code: 'TV_MODEL', label: 'TV Model', description: 'TV Model record in KB' },
    { code: 'KNOWLEDGE_FOLDER', label: 'KB Folder', description: 'Knowledge base folder for TV model' },
    { code: 'KNOWLEDGE_PAGE', label: 'KB Page', description: 'Knowledge base page content' },
    { code: 'MEDIA', label: 'Media Attachment', description: 'Cloudinary/Supabase media asset' },
  ];

  for (const et of entityTypes) {
    await prisma.entityType.upsert({
      where: { code: et.code },
      update: { label: et.label, description: et.description },
      create: { code: et.code, label: et.label, description: et.description, isSystem: true },
    });
  }
  console.log(`✅ Seeded ${entityTypes.length} EntityTypes.`);

  // ------------------------------------------------------------
  // 2. System Relationship Types (Universal Relationship Engine)
  // ------------------------------------------------------------
  const relationshipTypes = [
    {
      code: 'ITEM_COMPATIBLE_TV_MODEL',
      label: 'Compatible TV Model',
      forwardLabel: 'Compatible with TV Model',
      reverseLabel: 'Compatible Spare Part',
      sourceEntityType: 'ITEM',
      targetEntityType: 'TV_MODEL',
      description: 'Links a spare part item to compatible TV models',
    },
    {
      code: 'ITEM_ALTERNATIVE_ITEM',
      label: 'Alternative Item',
      forwardLabel: 'Can be replaced by',
      reverseLabel: 'Can replace',
      sourceEntityType: 'ITEM',
      targetEntityType: 'ITEM',
      description: 'Links an item to alternative/substitute items',
    },
    {
      code: 'PURCHASE_LIST_SUPPLIER',
      label: 'Purchase List Supplier',
      forwardLabel: 'Targeted to Supplier',
      reverseLabel: 'Associated Purchase List',
      sourceEntityType: 'PURCHASE_LIST',
      targetEntityType: 'SUPPLIER',
      description: 'Links a purchase list to a specific supplier',
    },
  ];

  for (const rt of relationshipTypes) {
    await prisma.relationshipType.upsert({
      where: { code: rt.code },
      update: {
        label: rt.label,
        forwardLabel: rt.forwardLabel,
        reverseLabel: rt.reverseLabel,
        sourceEntityType: rt.sourceEntityType,
        targetEntityType: rt.targetEntityType,
        description: rt.description,
      },
      create: {
        code: rt.code,
        label: rt.label,
        forwardLabel: rt.forwardLabel,
        reverseLabel: rt.reverseLabel,
        sourceEntityType: rt.sourceEntityType,
        targetEntityType: rt.targetEntityType,
        description: rt.description,
        isSystem: true,
      },
    });
  }
  console.log(`✅ Seeded ${relationshipTypes.length} RelationshipTypes.`);

  // ------------------------------------------------------------
  // 3. Default Users (Admin & Staff)
  // ------------------------------------------------------------
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@modernelectronics.com' },
    update: { fullName: 'MODERN ELECTRONICS Admin', role: UserRole.ADMIN },
    create: {
      email: 'admin@modernelectronics.com',
      fullName: 'MODERN ELECTRONICS Admin',
      role: UserRole.ADMIN,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: 'tech@modernelectronics.com' },
    update: { fullName: 'TV Technician Staff', role: UserRole.STAFF },
    create: {
      email: 'tech@modernelectronics.com',
      fullName: 'TV Technician Staff',
      role: UserRole.STAFF,
    },
  });

  console.log(`✅ Seeded default Admin (${adminUser.email}) and Staff (${staffUser.email}) users.`);
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/prisma';
import { createFolder, moveFolder, deleteFolder } from '../../src/features/inventory/services/folder.service';
import { createItem, getItemById, deleteItem } from '../../src/features/inventory/services/item.service';
import { linkItemToFolder, unlinkItemFromFolder } from '../../src/features/inventory/services/folder-item.service';
import { createStockMovement } from '../../src/features/inventory/services/stock-movement.service';
import { createSupplierRecord, getSupplierRecordByShortCode } from '../../src/features/inventory/services/supplier-record.service';
import { createTvBrand } from '../../src/features/knowledge-base/services/tv-brand.service';
import { createTvModel, getTvModelById } from '../../src/features/knowledge-base/services/tv-model.service';
import { createRelationship } from '../../src/features/relationships/services/relationship.service';
import { createPurchaseList, addItemToPurchaseList, receiveStockForPurchaseList } from '../../src/features/purchase-manager/services/purchase-list.service';
import { getSortedItems } from '../../src/features/analytics/services/analytics.service';
import { matchesOrderedPattern } from '../../src/features/search/services/search.service';
import { QuantityMode, StockMovementType, UserRole } from '@prisma/client';

test.describe.serial('MODERN ELECTRONICS — Complete Business Workflow Suite', () => {

  let testAdminUser: any;
  let testStaffUser: any;
  let rootFolder: any;
  let subFolder1: any;
  let subFolder2: any;
  let secondaryFolder: any;
  let createdItem: any;
  let firstShortCode: string;
  let secondShortCode: string;
  let tvBrand: any;
  let tvModel: any;
  let purchaseList: any;
  let purchaseListItem: any;

  test.beforeAll(async () => {
    // Retrieve or seed test users
    testAdminUser = await prisma.user.upsert({
      where: { email: 'admin@modernelectronics.com' },
      update: { role: UserRole.ADMIN },
      create: {
        email: 'admin@modernelectronics.com',
        fullName: 'Admin Test User',
        role: UserRole.ADMIN,
      },
    });

    testStaffUser = await prisma.user.upsert({
      where: { email: 'tech@modernelectronics.com' },
      update: { role: UserRole.STAFF },
      create: {
        email: 'tech@modernelectronics.com',
        fullName: 'Staff Test User',
        role: UserRole.STAFF,
      },
    });
  });

  test('SCENARIO 1: Inventory Hierarchy & Item Creation with Parameters', async () => {
    // 1. Create Folder: Backlight
    rootFolder = await createFolder({
      name: `Backlight_${Date.now()}`,
      createdById: testAdminUser.id,
    });
    expect(rootFolder.id).toBeDefined();

    // 2. Create Sub-Folder: 3 Volt
    subFolder1 = await createFolder({
      name: `3 Volt_${Date.now()}`,
      parentId: rootFolder.id,
      createdById: testAdminUser.id,
    });
    expect(subFolder1.parentId).toBe(rootFolder.id);

    // 3. Create Sub-Folder: 8 LED
    subFolder2 = await createFolder({
      name: `8 LED_${Date.now()}`,
      parentId: subFolder1.id,
      createdById: testAdminUser.id,
    });
    expect(subFolder2.parentId).toBe(subFolder1.id);

    // 4. Create Item: Samsung 8 LED Backlight
    createdItem = await createItem({
      name: `Samsung 8 LED Backlight_${Date.now()}`,
      location: 'Shelf A',
      quantityMode: QuantityMode.NUMERIC,
      quantity: 20,
      folderId: subFolder2.id,
      createdById: testAdminUser.id,
      notes: '3V 8LED strip for Samsung 43" series',
    });
    expect(createdItem.id).toBeDefined();
    expect(createdItem.quantity).toBe(20);
    expect(createdItem.location).toBe('Shelf A');

    // 5. Add Supplier Record: ABC Electronics (Cost=120, Selling=250)
    const record1 = await createSupplierRecord({
      itemId: createdItem.id,
      supplierName: 'ABC Electronics',
      costPrice: 120,
      sellingPrice: 250,
      remarks: 'Batch 1 purchase',
      createdById: testAdminUser.id,
    });
    expect(record1.shortCode).toHaveLength(4);
    firstShortCode = record1.shortCode;

    // Verify item details
    const fetched = await getItemById(createdItem.id);
    expect(fetched.name).toBe(createdItem.name);
    expect(fetched.supplierRecords.length).toBeGreaterThanOrEqual(1);
    expect(Number(fetched.supplierRecords[0].costPrice)).toBe(120);
    expect(Number(fetched.supplierRecords[0].sellingPrice)).toBe(250);
  });

  test('SCENARIO 2: Multi-Folder Architecture & No Duplication', async () => {
    // 1. Create a second folder: Universal Backlight
    secondaryFolder = await createFolder({
      name: `Universal Backlight_${Date.now()}`,
      createdById: testAdminUser.id,
    });

    // 2. Link existing item to second folder
    const link = await linkItemToFolder(secondaryFolder.id, createdItem.id, testAdminUser.id);
    expect(link.folderId).toBe(secondaryFolder.id);
    expect(link.itemId).toBe(createdItem.id);

    // 3. Verify Item quantity is shared (not duplicated)
    const itemInDb = await getItemById(createdItem.id);
    expect(itemInDb.folderItems.length).toBe(2);
    expect(itemInDb.quantity).toBe(20);

    // 4. Unlink from secondary folder -> Item must still exist
    await unlinkItemFromFolder(secondaryFolder.id, createdItem.id, testAdminUser.id);
    const itemAfterUnlink = await getItemById(createdItem.id);
    expect(itemAfterUnlink.folderItems.length).toBe(1);
    expect(itemAfterUnlink.id).toBe(createdItem.id);
  });

  test('SCENARIO 3: Stock Movement (SALE -1) & Audit Trail', async () => {
    // 1. Staff records SALE of 1 unit
    const movement = await createStockMovement({
      itemId: createdItem.id,
      movementType: StockMovementType.SALE,
      quantityChange: -1,
      performedById: testStaffUser.id,
      notes: 'Counter sale for repair job #402',
    });

    expect(movement.previousQuantity).toBe(20);
    expect(movement.newQuantity).toBe(19);
    expect(movement.quantityChange).toBe(-1);

    // 2. Verify Item quantity updated in DB
    const item = await getItemById(createdItem.id);
    expect(item.quantity).toBe(19);
    expect(item.isOutOfStock).toBe(false);
  });

  test('SCENARIO 4: Append-Only Price History & Short Code Search', async () => {
    // 1. Add second supplier record: XYZ Spares (Cost=150, Selling=300)
    const record2 = await createSupplierRecord({
      itemId: createdItem.id,
      supplierName: 'XYZ Spares',
      costPrice: 150,
      sellingPrice: 300,
      remarks: 'Batch 2 imported stock',
      createdById: testAdminUser.id,
    });
    expect(record2.shortCode).toHaveLength(4);
    secondShortCode = record2.shortCode;
    expect(secondShortCode).not.toBe(firstShortCode);

    // 2. Verify append-only history (both records preserved)
    const item = await getItemById(createdItem.id);
    expect(item.supplierRecords.length).toBe(2);

    // 3. Search by short code -> exact record match
    const foundRecord = await getSupplierRecordByShortCode(firstShortCode);
    expect(foundRecord).not.toBeNull();
    expect(foundRecord?.supplierName).toBe('ABC Electronics');
    expect(Number(foundRecord?.costPrice)).toBe(120);
  });

  test('SCENARIO 5: Ordered Pattern Search Algorithm Verification', () => {
    // 1. Existing baseline tests
    expect(matchesOrderedPattern('apple', 'apple')).toBe(true);
    expect(matchesOrderedPattern('apple', 'apple1212')).toBe(true);
    expect(matchesOrderedPattern('apple', 'aaapple')).toBe(true);
    expect(matchesOrderedPattern('apple', 'app232le')).toBe(true);
    expect(matchesOrderedPattern('apple', 'apple_backlight')).toBe(true);
    expect(matchesOrderedPattern('apple', 'ppale')).toBe(false);
    expect(matchesOrderedPattern('apple', 'leppa')).toBe(false);
    expect(matchesOrderedPattern('apple', 'aplpe')).toBe(false);

    // 2. User Example 1: Target = "samsung backlight 1"
    const target1 = 'samsung backlight 1';
    expect(matchesOrderedPattern('ssung', target1)).toBe(true);
    expect(matchesOrderedPattern('ungback', target1)).toBe(true);
    expect(matchesOrderedPattern('smuback', target1)).toBe(true);
    expect(matchesOrderedPattern('backsamsu', target1)).toBe(false);
    expect(matchesOrderedPattern('1back', target1)).toBe(false);

    // 3. User Example 2: Target = "4-3-32" (special characters & spaces ignored)
    const target2 = '4-3-32';
    expect(matchesOrderedPattern('4332', target2)).toBe(true);
    expect(matchesOrderedPattern('332', target2)).toBe(true);
    expect(matchesOrderedPattern('4 3 32', target2)).toBe(true);
    expect(matchesOrderedPattern('4/3/32', target2)).toBe(true);
  });

  test('SCENARIO 6: TV Knowledge Base & 2 Default Folders & Compatibility', async () => {
    // 1. Create TV Brand: Samsung
    tvBrand = await createTvBrand({
      name: `Samsung_${Date.now()}`,
    });
    expect(tvBrand.id).toBeDefined();

    // 2. Create TV Model: Model XYZ
    tvModel = await createTvModel({
      brandId: tvBrand.id,
      modelNumber: `UA43NU7100_${Date.now()}`,
      screenSize: 43,
      displayType: 'LED UHD',
      chassisNo: 'CH-8821',
      notes: 'Common backlight failure model',
    });
    expect(tvModel.id).toBeDefined();

    // 3. Verify exactly 2 default system folders are initialized: Backlight & More info
    const modelDetails = await getTvModelById(tvModel.id);
    expect(modelDetails.knowledgeFolders.length).toBe(2);
    const folderNames = modelDetails.knowledgeFolders.map((f: any) => f.name);
    expect(folderNames).toContain('Backlight');
    expect(folderNames).toContain('More info');

    // 4. Link Item to TV Model using Relationship Engine
    const rel = await createRelationship({
      relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL',
      sourceEntityId: createdItem.entityId,
      targetEntityId: tvModel.entityId,
      createdById: testAdminUser.id,
      notes: 'Original compatible 8-LED strip',
    });
    expect(rel.id).toBeDefined();
  });

  test('SCENARIO 7: Purchase Manager, Auto-Suggest, PDF & Stock Receiving', async () => {
    // 1. Mark item out of stock
    await prisma.item.update({
      where: { id: createdItem.id },
      data: { isOutOfStock: true },
    });

    // 2. Create Purchase List
    purchaseList = await createPurchaseList({
      title: `Urgent Restock Order #${Date.now()}`,
      notes: 'MODERN ELECTRONICS monthly procurement',
      createdById: testAdminUser.id,
    });
    expect(purchaseList.id).toBeDefined();

    // 3. Add Item to Purchase List (Qty 50)
    purchaseListItem = await addItemToPurchaseList({
      purchaseListId: purchaseList.id,
      itemId: createdItem.id,
      quantity: 50,
      estimatedCost: 120,
      notes: '50 sets for seasonal repair demand',
    });
    expect(purchaseListItem.quantity).toBe(50);

    // 4. Receive Stock (Idempotent: 50 units received)
    const receiveResult = await receiveStockForPurchaseList(
      purchaseList.id,
      [
        {
          purchaseListItemId: purchaseListItem.id,
          itemId: createdItem.id,
          receivedQty: 50,
        },
      ],
      testAdminUser.id
    );
    expect(receiveResult.success).toBe(true);

    // 5. Verify quantity increases from 19 to 69
    const updatedItem = await getItemById(createdItem.id);
    expect(updatedItem.quantity).toBe(69);
    expect(updatedItem.isOutOfStock).toBe(false);

    // 6. Verify PURCHASE StockMovement was recorded
    const movements = await prisma.stockMovement.findMany({
      where: { itemId: createdItem.id, movementType: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(movements.length).toBeGreaterThanOrEqual(1);
    expect(movements[0].quantityChange).toBe(50);
    expect(movements[0].newQuantity).toBe(69);
  });

  test('SCENARIO 8: Price-Based Smart Sorting', async () => {
    const highestCost = await getSortedItems({
      sortMode: 'HIGHEST_COST_PRICE',
      limit: 10,
    });
    expect(highestCost.items.length).toBeGreaterThan(0);

    const lowestSelling = await getSortedItems({
      sortMode: 'LOWEST_SELLING_PRICE',
      limit: 10,
    });
    expect(lowestSelling.items.length).toBeGreaterThan(0);

    const mostSelling = await getSortedItems({
      sortMode: 'MOST_SELLING',
      limit: 10,
    });
    expect(mostSelling.items.length).toBeGreaterThan(0);
  });
});

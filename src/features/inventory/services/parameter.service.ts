// ============================================================
// RD-3: Dynamic Parameter Inheritance Service
// ============================================================
// Collects ParameterDefinition records from Universal (Root) scope,
// target folder AND all ancestor folders using materialized_path column.
// Override rule: Nearest/deepest ancestor definition wins on slug collision.
// Parameter definitions are NEVER physically copied into child folders or Items.

import { prisma } from '@/lib/prisma';
import { ParameterDefinition, ParameterValueType } from '@prisma/client';

export interface EffectiveParameterDefinition extends ParameterDefinition {
  inheritedFromFolderId?: string;
  inheritedFromFolderName?: string;
  isOverridden?: boolean;
  overriddenFolderName?: string;
}

/**
 * Resolves the complete effective parameter definitions for a given folder.
 * Traverses Universal (Root) -> ancestors from root -> folder, merging definitions by `slug`.
 * Deepest ancestor (closest to target folder) overrides higher ancestors.
 */
export async function getEffectiveParameterDefinitions(
  folderId?: string | null
): Promise<EffectiveParameterDefinition[]> {
  const effectiveMap = new Map<string, EffectiveParameterDefinition>();

  // 1. Fetch Universal Parameters (folderId === null) that apply to ALL folders & items
  const universalDefs = await prisma.parameterDefinition.findMany({
    where: { folderId: null },
    orderBy: { sortOrder: 'asc' },
  });

  for (const def of universalDefs) {
    effectiveMap.set(def.slug, {
      ...def,
      inheritedFromFolderName: 'Universal',
      isOverridden: false,
    });
  }

  // If no folderId requested (e.g. root inventory item creation), return universal parameters
  if (!folderId) {
    return Array.from(effectiveMap.values());
  }

  // 2. Fetch current folder to get materialized_path
  const targetFolder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, name: true, parentId: true, materializedPath: true },
  });

  if (!targetFolder) {
    return Array.from(effectiveMap.values());
  }

  // 3. Parse ancestor folder IDs from materializedPath (format: "root_id/child_id/sub_id")
  const ancestorIds = targetFolder.materializedPath
    ? targetFolder.materializedPath.split('/').filter(Boolean)
    : [folderId];

  if (!ancestorIds.includes(folderId)) {
    ancestorIds.push(folderId);
  }

  // 4. Fetch all ancestor folders and their defined parameter definitions in order
  const ancestorFolders = await prisma.folder.findMany({
    where: { id: { in: ancestorIds } },
    select: {
      id: true,
      name: true,
      depth: true,
      parameterDefinitions: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { depth: 'asc' }, // Root -> Child
  });

  // Map folder depth to index
  const folderMap = new Map(ancestorFolders.map((f) => [f.id, f]));

  // 5. Merge definitions in root -> target order (nearer wins)
  for (const ancestorId of ancestorIds) {
    const folder = folderMap.get(ancestorId);
    if (!folder) continue;

    const isCurrentFolder = folder.id === folderId;

    for (const def of folder.parameterDefinitions) {
      const existing = effectiveMap.get(def.slug);

      const effectiveDef: EffectiveParameterDefinition = {
        ...def,
        inheritedFromFolderId: isCurrentFolder ? undefined : folder.id,
        inheritedFromFolderName: isCurrentFolder ? undefined : folder.name,
        isOverridden: !!existing,
        overriddenFolderName: existing ? (existing.inheritedFromFolderName || 'Ancestor Folder') : undefined,
      };

      // Overwrite slug key — deeper folder's definition takes precedence
      effectiveMap.set(def.slug, effectiveDef);
    }
  }

  return Array.from(effectiveMap.values());
}

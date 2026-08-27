// ============================================================
// Universal Relationship Engine Service
// ============================================================
// Generic junction layer connecting any entities in the Entity Registry.
// Supports forward and reverse graph traversals with relationship typing.

import { prisma } from '@/lib/prisma';
import { EntityRelationship } from '@prisma/client';

export interface CreateRelationshipInput {
  relationshipTypeCode: string;
  sourceEntityId: string;
  targetEntityId: string;
  notes?: string;
  createdById?: string;
}

export interface RelatedEntityResult {
  relationshipId: string;
  direction: 'FORWARD' | 'REVERSE';
  relationshipTypeCode: string;
  relationshipLabel: string;
  entityId: string;
  displayName: string;
  entityTypeCode: string;
  notes?: string;
}

/**
 * Connects two entities with a typed relationship.
 */
export async function createRelationship(
  input: CreateRelationshipInput
): Promise<EntityRelationship> {
  const existing = await prisma.entityRelationship.findUnique({
    where: {
      relationshipTypeCode_sourceEntityId_targetEntityId: {
        relationshipTypeCode: input.relationshipTypeCode,
        sourceEntityId: input.sourceEntityId,
        targetEntityId: input.targetEntityId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return await prisma.entityRelationship.create({
    data: {
      relationshipTypeCode: input.relationshipTypeCode,
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      notes: input.notes,
      createdById: input.createdById,
    },
  });
}

/**
 * Returns all entities related to a given entity (both forward & reverse direction).
 */
export async function getRelatedEntities(
  entityId: string,
  relationshipTypeCode?: string
): Promise<RelatedEntityResult[]> {
  // Forward relationships (entity is source)
  const forwardRels = await prisma.entityRelationship.findMany({
    where: {
      sourceEntityId: entityId,
      relationshipTypeCode: relationshipTypeCode ? relationshipTypeCode : undefined,
    },
    include: {
      relationshipType: true,
      targetEntity: true,
    },
  });

  // Reverse relationships (entity is target)
  const reverseRels = await prisma.entityRelationship.findMany({
    where: {
      targetEntityId: entityId,
      relationshipTypeCode: relationshipTypeCode ? relationshipTypeCode : undefined,
    },
    include: {
      relationshipType: true,
      sourceEntity: true,
    },
  });

  const results: RelatedEntityResult[] = [];

  for (const rel of forwardRels) {
    results.push({
      relationshipId: rel.id,
      direction: 'FORWARD',
      relationshipTypeCode: rel.relationshipTypeCode,
      relationshipLabel: rel.relationshipType.forwardLabel,
      entityId: rel.targetEntity.id,
      displayName: rel.targetEntity.displayName,
      entityTypeCode: rel.targetEntity.entityTypeCode,
      notes: rel.notes || undefined,
    });
  }

  for (const rel of reverseRels) {
    results.push({
      relationshipId: rel.id,
      direction: 'REVERSE',
      relationshipTypeCode: rel.relationshipTypeCode,
      relationshipLabel: rel.relationshipType.reverseLabel,
      entityId: rel.sourceEntity.id,
      displayName: rel.sourceEntity.displayName,
      entityTypeCode: rel.sourceEntity.entityTypeCode,
      notes: rel.notes || undefined,
    });
  }

  return results;
}

/**
 * Removes a relationship link between two entities.
 */
export async function deleteRelationship(relationshipId: string): Promise<void> {
  await prisma.entityRelationship.delete({
    where: { id: relationshipId },
  });
}

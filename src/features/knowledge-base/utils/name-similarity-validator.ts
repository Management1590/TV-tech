/**
 * Knowledge Base Name Collision & Similarity Validator
 * 
 * Rules:
 * 1. Normalized comparison: Strips all spaces, hyphens, and non-alphanumeric characters (case-insensitive).
 * 2. Exact Match (BLOCK): Cannot create/rename an entity to an identical name.
 * 3. 8+ Sequential Alphanumeric Match (BLOCK): Strictly restricted if candidate shares 8+ consecutive characters.
 * 4. 5 to 7 Sequential Alphanumeric Match (WARN): Shows a non-blocking warning informing that the model is in existence and allowing the user to proceed.
 */

export function normalizeAlphanumeric(input: string): string {
  if (!input) return '';
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type CollisionLevel = 'BLOCK' | 'WARN' | 'NONE';

export interface NameCollisionResult {
  level: CollisionLevel;
  hasConflict: boolean; // true if BLOCK
  hasWarning: boolean;  // true if WARN
  reason?: 'EXACT_MATCH' | 'SEQUENTIAL_8_MATCH' | 'SEQUENTIAL_SIMILARITY_WARN';
  conflictingName?: string;
  matchedSequence?: string;
  matchLength?: number;
  message?: string;
}

/**
 * Checks a candidate name against an array of existing names in the same directory.
 * 
 * @param candidate The name to validate
 * @param existingList List of existing names in the same directory (excluding the item itself if renaming)
 * @param entityType 'Brand' | 'Model'
 */
export function validateNameSimilarity(
  candidate: string,
  existingList: string[],
  entityType: 'Brand' | 'Model' = 'Model'
): NameCollisionResult {
  const cleanCand = candidate.trim();
  const candNorm = normalizeAlphanumeric(cleanCand);

  if (!candNorm) {
    return { level: 'NONE', hasConflict: false, hasWarning: false };
  }

  const BLOCK_SEQ_LEN = 8;
  const WARN_MIN_LEN = 5;

  let highestWarning: {
    conflictingName: string;
    matchedSequence: string;
    matchLength: number;
  } | null = null;

  for (const existing of existingList) {
    if (!existing) continue;
    const existClean = existing.trim();
    const existNorm = normalizeAlphanumeric(existClean);
    if (!existNorm) continue;

    // Rule 1: Exact normalized alphanumeric match -> STRICT BLOCK
    if (candNorm === existNorm) {
      return {
        level: 'BLOCK',
        hasConflict: true,
        hasWarning: false,
        reason: 'EXACT_MATCH',
        conflictingName: existClean,
        message: `A ${entityType.toLowerCase()} with the name "${existClean}" already exists.`,
      };
    }

    // Rule 2: 8+ character sequential alphanumeric matching -> STRICT BLOCK
    if (candNorm.length >= BLOCK_SEQ_LEN && existNorm.length >= BLOCK_SEQ_LEN) {
      for (let i = 0; i <= candNorm.length - BLOCK_SEQ_LEN; i++) {
        const windowSeq = candNorm.substring(i, i + BLOCK_SEQ_LEN);
        if (existNorm.includes(windowSeq)) {
          return {
            level: 'BLOCK',
            hasConflict: true,
            hasWarning: false,
            reason: 'SEQUENTIAL_8_MATCH',
            conflictingName: existClean,
            matchedSequence: windowSeq.toUpperCase(),
            matchLength: BLOCK_SEQ_LEN,
            message: `Cannot create ${entityType.toLowerCase()} "${cleanCand}". It shares 8 sequential characters ("${windowSeq.toUpperCase()}") with existing ${entityType.toLowerCase()} "${existClean}".`,
          };
        }
      }

      for (let i = 0; i <= existNorm.length - BLOCK_SEQ_LEN; i++) {
        const windowSeq = existNorm.substring(i, i + BLOCK_SEQ_LEN);
        if (candNorm.includes(windowSeq)) {
          return {
            level: 'BLOCK',
            hasConflict: true,
            hasWarning: false,
            reason: 'SEQUENTIAL_8_MATCH',
            conflictingName: existClean,
            matchedSequence: windowSeq.toUpperCase(),
            matchLength: BLOCK_SEQ_LEN,
            message: `Cannot create ${entityType.toLowerCase()} "${cleanCand}". It shares 8 sequential characters ("${windowSeq.toUpperCase()}") with existing ${entityType.toLowerCase()} "${existClean}".`,
          };
        }
      }
    }

    // Rule 3: 5, 6, or 7 character sequential match -> SOFT WARNING
    // We scan for the longest sub-match between 5 and 7 characters
    const maxLen = Math.min(7, candNorm.length, existNorm.length);
    for (let len = maxLen; len >= WARN_MIN_LEN; len--) {
      // If we already found a longer or equal warning, don't downgrade
      if (highestWarning && highestWarning.matchLength >= len) {
        break;
      }

      let foundSub: string | null = null;
      for (let i = 0; i <= candNorm.length - len; i++) {
        const sub = candNorm.substring(i, i + len);
        if (existNorm.includes(sub)) {
          foundSub = sub;
          break;
        }
      }

      if (foundSub) {
        highestWarning = {
          conflictingName: existClean,
          matchedSequence: foundSub.toUpperCase(),
          matchLength: len,
        };
        break;
      }
    }
  }

  // If a 5, 6, or 7 match was detected and not blocked by 8+ rule, return WARN
  if (highestWarning) {
    return {
      level: 'WARN',
      hasConflict: false,
      hasWarning: true,
      reason: 'SEQUENTIAL_SIMILARITY_WARN',
      conflictingName: highestWarning.conflictingName,
      matchedSequence: highestWarning.matchedSequence,
      matchLength: highestWarning.matchLength,
      message: `Warning: This ${entityType.toLowerCase()} shares ${highestWarning.matchLength} sequential characters ("${highestWarning.matchedSequence}") with existing ${entityType.toLowerCase()} "${highestWarning.conflictingName}". Proceed to continue?`,
    };
  }

  return { level: 'NONE', hasConflict: false, hasWarning: false };
}

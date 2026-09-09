/**
 * Knowledge Base Name Collision & Similarity Validator
 * 
 * Rules:
 * 1. Normalized comparison: Strips all spaces, hyphens, and non-alphanumeric characters (case-insensitive).
 * 2. Exact Match (BLOCK): Duplicate entity names in the same directory are strictly prevented.
 * 3. 11+ Sequential Alphanumeric Match (WARN_11): Displays a high-intensity "crazy red" critical similarity warning banner. Non-blocking (user can proceed).
 * 4. 8 to 10 Sequential Alphanumeric Match (WARN_8): Displays a red similarity warning banner. Non-blocking (user can proceed).
 * 5. 5 to 7 Sequential Alphanumeric Match (WARN_5): Displays a soft amber similarity notice. Non-blocking (user can proceed).
 */

export function normalizeAlphanumeric(input: string): string {
  if (!input) return '';
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type CollisionLevel = 'BLOCK' | 'WARN_11' | 'WARN_8' | 'WARN_5' | 'WARN' | 'NONE';

export interface NameCollisionResult {
  level: CollisionLevel;
  hasConflict: boolean; // true ONLY if exact duplicate (BLOCK)
  hasWarning: boolean;  // true if WARN_11, WARN_8, WARN_5, or WARN
  reason?: 'EXACT_MATCH' | 'SEQUENTIAL_11_MATCH' | 'SEQUENTIAL_8_MATCH' | 'SEQUENTIAL_5_MATCH' | 'SEQUENTIAL_SIMILARITY_WARN';
  conflictingName?: string;
  matchedSequence?: string;
  matchLength?: number;
  message?: string;
}

/**
 * Finds the longest common substring between two strings.
 */
function findLongestCommonSubstring(str1: string, str2: string): { sequence: string; length: number } {
  let longestSeq = '';
  let maxLen = 0;

  for (let i = 0; i < str1.length; i++) {
    for (let j = i + 1; j <= str1.length; j++) {
      const sub = str1.substring(i, j);
      if (str2.includes(sub) && sub.length > maxLen) {
        maxLen = sub.length;
        longestSeq = sub;
      }
    }
  }

  return { sequence: longestSeq, length: maxLen };
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

  let highestMatch: {
    conflictingName: string;
    sequence: string;
    length: number;
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

    // Compute longest sequential match with this item
    const common = findLongestCommonSubstring(candNorm, existNorm);
    if (common.length >= 5) {
      if (!highestMatch || common.length > highestMatch.length) {
        highestMatch = {
          conflictingName: existClean,
          sequence: common.sequence,
          length: common.length,
        };
      }
    }
  }

  if (highestMatch) {
    const upperSeq = highestMatch.sequence.toUpperCase();
    const matchLen = highestMatch.length;

    // Rule 2: 11+ sequential character match -> "Crazy Red" Critical Warning (Non-blocking)
    if (matchLen >= 11) {
      return {
        level: 'WARN_11',
        hasConflict: false,
        hasWarning: true,
        reason: 'SEQUENTIAL_11_MATCH',
        conflictingName: highestMatch.conflictingName,
        matchedSequence: upperSeq,
        matchLength: matchLen,
        message: `Critical Warning: ${matchLen} sequential characters ("${upperSeq}") match with existing ${entityType.toLowerCase()} "${highestMatch.conflictingName}". Proceed to continue?`,
      };
    }

    // Rule 3: 8 to 10 sequential character match -> Red Warning (Non-blocking)
    if (matchLen >= 8) {
      return {
        level: 'WARN_8',
        hasConflict: false,
        hasWarning: true,
        reason: 'SEQUENTIAL_8_MATCH',
        conflictingName: highestMatch.conflictingName,
        matchedSequence: upperSeq,
        matchLength: matchLen,
        message: `Warning: ${matchLen} sequential characters ("${upperSeq}") match with existing ${entityType.toLowerCase()} "${highestMatch.conflictingName}". Proceed to continue?`,
      };
    }

    // Rule 4: 5 to 7 sequential character match -> Amber Notice (Non-blocking)
    return {
      level: 'WARN_5',
      hasConflict: false,
      hasWarning: true,
      reason: 'SEQUENTIAL_5_MATCH',
      conflictingName: highestMatch.conflictingName,
      matchedSequence: upperSeq,
      matchLength: matchLen,
      message: `Notice: This ${entityType.toLowerCase()} shares ${matchLen} sequential characters ("${upperSeq}") with existing ${entityType.toLowerCase()} "${highestMatch.conflictingName}". Proceed to continue?`,
    };
  }

  return { level: 'NONE', hasConflict: false, hasWarning: false };
}

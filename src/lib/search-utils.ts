/**
 * Client-safe pure search algorithms for TV Tech OS
 * Enhanced Multi-Token, Typo-Tolerant, TV-Domain Search Engine
 */

/**
 * Normalizes text for search by converting to lowercase and stripping all non-alphanumeric characters.
 * Spaces, hyphens, slashes, periods, etc. are completely ignored.
 */
export function normalizeSearchString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Computes Damerau-Levenshtein distance between two strings.
 * Includes insertion, deletion, substitution, and adjacent transposition.
 * Highly optimized for short string matching (< 50 chars).
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));

  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Damerau adjacent transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[al][bl];
}

/**
 * Standard TV screen sizes in inches for intent recognition.
 */
export const STANDARD_SCREEN_SIZES = new Set([
  24, 28, 32, 40, 42, 43, 48, 49, 50, 55, 58, 60, 65, 70, 75, 77, 82, 85, 86, 98,
]);

/**
 * Extracts a TV screen size integer intent if present in query.
 * Matches: 55", 55 inch, 55in, or standalone 2-digit number in standard sizes.
 */
export function extractScreenSizeIntent(query: string): number | null {
  if (!query) return null;

  // 1. Explicit pattern: 55", 55 inch, 55-inch, 55in
  const explicitMatch = query.match(/\b(2[48]|32|4[02389]|5[058]|6[05]|7[057]|8[256]|98)\s*(?:"|''|inch(?:es)?|in|-inch)\b/i);
  if (explicitMatch) {
    return parseInt(explicitMatch[1], 10);
  }

  // 2. Standalone 2-digit token in query matching standard TV sizes
  const tokens = query.trim().split(/\s+/);
  for (const token of tokens) {
    const cleanDigits = token.replace(/[^0-9]/g, '');
    if (cleanDigits.length === 2) {
      const num = parseInt(cleanDigits, 10);
      if (STANDARD_SCREEN_SIZES.has(num)) {
        return num;
      }
    }
  }

  return null;
}

/**
 * TV industry technical synonyms and equivalent terms.
 */
export const TV_SYNONYM_GROUPS: Record<string, string[]> = {
  '4k': ['uhd', '2160p', '3840'],
  'uhd': ['4k', '2160p', '3840'],
  '2k': ['fhd', '1080p'],
  'fhd': ['2k', '1080p'],
  'hd': ['720p'],
  'oled': ['woled', 'qdoled'],
  'qled': ['nanocell', 'miniled'],
  'bl': ['backlight', 'led'],
  'backlight': ['bl', 'led'],
  'mb': ['motherboard', 'mainboard'],
  'mainboard': ['mb', 'motherboard'],
  'motherboard': ['mb', 'mainboard'],
  'tcon': ['timing control', 'logic board', 't-con'],
  'psu': ['power supply', 'smps', 'power board'],
  'smps': ['power supply', 'psu'],
  'smart': ['android', 'webos', 'tizen', 'google tv'],
};

/**
 * Returns list of synonym expansions for a given token.
 */
export function getSynonymExpansions(token: string): string[] {
  const clean = token.toLowerCase().trim();
  const synonyms = TV_SYNONYM_GROUPS[clean] || [];
  return [clean, ...synonyms];
}

/**
 * Checks if query appears as an ordered sequence in target (left-to-right, index strictly increasing).
 * Both query and target are normalized to alphanumeric characters only.
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
      if (qIdx === q.length) return true;
    }
  }

  return false;
}

/**
 * Evaluates whether an individual search token matches a text field.
 * Handles exact substrings, ordered sequences, synonym expansions, and typo tolerance.
 */
export function matchesToken(
  token: string,
  text: string
): { matches: boolean; score: number; isExact: boolean } {
  if (!token || !text) return { matches: false, score: 0, isExact: false };

  const cleanToken = token.trim().toLowerCase();
  const cleanText = text.trim().toLowerCase();
  const normToken = normalizeSearchString(cleanToken);
  const normText = normalizeSearchString(cleanText);

  if (!normToken || !normText) return { matches: false, score: 0, isExact: false };

  // 1. Exact match
  if (cleanText === cleanToken || normText === normToken) {
    return { matches: true, score: 100, isExact: true };
  }

  // 2. Starts with token
  if (cleanText.startsWith(cleanToken) || normText.startsWith(normToken)) {
    return { matches: true, score: 90, isExact: true };
  }

  // 3. Contiguous substring
  if (cleanText.includes(cleanToken) || normText.includes(normToken)) {
    return { matches: true, score: 80, isExact: true };
  }

  // 4. Ordered pattern (subsequence)
  if (matchesOrderedPattern(cleanToken, cleanText)) {
    const densityRatio = normToken.length / Math.max(normText.length, 1);
    const score = Math.round(50 + densityRatio * 30);
    return { matches: true, score, isExact: false };
  }

  // 5. Technical TV synonyms
  const synonyms = TV_SYNONYM_GROUPS[cleanToken];
  if (synonyms) {
    for (const syn of synonyms) {
      if (cleanText.includes(syn) || normText.includes(normalizeSearchString(syn))) {
        return { matches: true, score: 75, isExact: false };
      }
      if (matchesOrderedPattern(syn, cleanText)) {
        return { matches: true, score: 60, isExact: false };
      }
    }
  }

  // 6. Typo / Fuzzy tolerance (Damerau-Levenshtein)
  // Safeguards:
  // - Disable fuzzy if token is purely numeric to avoid mixing up screen sizes or chassis codes.
  // - Only allow distance <= 1 for tokens of length 4-7, distance <= 2 for length >= 8.
  const isPureNumber = /^\d+$/.test(normToken);
  if (!isPureNumber && normToken.length >= 4) {
    const maxAllowedDist = normToken.length >= 8 ? 2 : 1;

    // Check individual words in target
    const words = cleanText.split(/[\s\-_/.,;:()[\]]+/).filter(Boolean);
    for (const word of words) {
      const normWord = normalizeSearchString(word);
      if (normWord.length >= 3 && Math.abs(normWord.length - normToken.length) <= maxAllowedDist) {
        const dist = calculateLevenshteinDistance(normToken, normWord);
        if (dist <= maxAllowedDist) {
          return { matches: true, score: Math.max(45, 70 - dist * 15), isExact: false };
        }
      }
    }

    // Check sliding window across target if target doesn't have spaces (e.g. model numbers)
    if (normText.length >= normToken.length) {
      const windowLengths = [normToken.length - 1, normToken.length, normToken.length + 1];
      for (const len of windowLengths) {
        if (len >= 4 && len <= normText.length) {
          for (let i = 0; i <= normText.length - len; i++) {
            const slice = normText.slice(i, i + len);
            const dist = calculateLevenshteinDistance(normToken, slice);
            if (dist <= maxAllowedDist) {
              return { matches: true, score: Math.max(40, 65 - dist * 15), isExact: false };
            }
          }
        }
      }
    }
  }

  return { matches: false, score: 0, isExact: false };
}

/**
 * Computes relevance score for ranking search results.
 * Backward compatible with existing call sites.
 */
export function calculateMatchScore(query: string, text: string): number {
  const res = matchesToken(query, text);
  return res.score;
}

export interface ModelSearchData {
  modelNumber: string;
  notes?: string | null;
  chassisNo?: string | null;
  displayType?: string | null;
  screenSize?: number | null;
  brandName?: string | null;
}

export interface ModelSearchResult {
  isMatch: boolean;
  score: number;
  isModelMatch: boolean;
  isDescMatch: boolean;
}

/**
 * Evaluates multi-token search for a TV model.
 * Performs cross-field token matching (AND semantics across tokens):
 * all tokens must match somewhere in the model entity (model number, notes, chassis, display, size).
 */
export function evaluateModelSearch(
  query: string,
  model: ModelSearchData
): ModelSearchResult {
  const cleanQ = query.trim();
  if (!cleanQ) {
    return { isMatch: true, score: 0, isModelMatch: false, isDescMatch: false };
  }

  const cleanModelNumber = model.modelNumber.replace(/_\d{10,}$/, '');
  const cleanNotes = model.notes?.trim() || '';
  const cleanChassis = model.chassisNo?.trim() || '';
  const cleanDisplay = model.displayType?.trim() || '';

  const tokens = cleanQ.split(/\s+/).filter(Boolean);
  const sizeIntent = extractScreenSizeIntent(cleanQ);

  let totalScore = 0;
  let hasModelMatch = false;
  let hasDescMatch = false;

  for (const token of tokens) {
    const modelRes = matchesToken(token, cleanModelNumber);
    const descRes = cleanNotes ? matchesToken(token, cleanNotes) : { matches: false, score: 0, isExact: false };
    const chassisRes = cleanChassis ? matchesToken(token, cleanChassis) : { matches: false, score: 0, isExact: false };
    const displayRes = cleanDisplay ? matchesToken(token, cleanDisplay) : { matches: false, score: 0, isExact: false };

    // Check screen size token match
    let sizeMatched = false;
    let sizeScore = 0;
    if (model.screenSize) {
      const cleanDigits = token.replace(/[^0-9]/g, '');
      if (cleanDigits && parseInt(cleanDigits, 10) === model.screenSize) {
        sizeMatched = true;
        sizeScore = 85;
      }
    }

    const tokenMatched =
      modelRes.matches ||
      descRes.matches ||
      chassisRes.matches ||
      displayRes.matches ||
      sizeMatched;

    // AND condition: every token must match somewhere across the model entity
    if (!tokenMatched) {
      return { isMatch: false, score: 0, isModelMatch: false, isDescMatch: false };
    }

    if (modelRes.matches) hasModelMatch = true;
    if (descRes.matches) hasDescMatch = true;

    const bestTokenScore = Math.max(
      modelRes.score,
      descRes.score,
      chassisRes.score,
      displayRes.score,
      sizeScore
    );
    totalScore += bestTokenScore;
  }

  // Field priority bonuses
  if (hasModelMatch) {
    totalScore += 60; // Direct model hit priority
  }
  if (hasDescMatch) {
    totalScore += 25; // Description match
  }

  // Screen size intent bonus
  if (sizeIntent && model.screenSize === sizeIntent) {
    totalScore += 35;
  }

  // Full exact match on model number gives maximum boost
  const normFullQ = normalizeSearchString(cleanQ);
  const normModel = normalizeSearchString(cleanModelNumber);
  if (normModel === normFullQ) {
    totalScore += 100;
  } else if (normModel.startsWith(normFullQ)) {
    totalScore += 50;
  }

  return {
    isMatch: true,
    score: totalScore,
    isModelMatch: hasModelMatch,
    isDescMatch: hasDescMatch,
  };
}

/**
 * Finds all character index ranges [startIndex, endIndex] in `text` that match `query`.
 * Supports exact contiguous matches, individual word tokens, synonym expansions,
 * typo tolerance, and ordered pattern matches.
 * Automatically sorts and merges overlapping ranges for clean rendering.
 */
export function getHighlightedRanges(text: string, query: string): [number, number][] {
  if (!text || !query || !query.trim()) return [];

  const cleanQuery = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();

  const ranges: [number, number][] = [];

  // Helper to safely add range
  const addRange = (start: number, end: number) => {
    if (start >= 0 && end <= text.length && start < end) {
      ranges.push([start, end]);
    }
  };

  // 1. Contiguous full query match
  let fullIdx = lowerText.indexOf(lowerQuery);
  while (fullIdx !== -1) {
    addRange(fullIdx, fullIdx + lowerQuery.length);
    fullIdx = lowerText.indexOf(lowerQuery, fullIdx + 1);
  }

  // 2. Token-by-token matching including synonyms and fuzzy words
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const expansions = getSynonymExpansions(token);
    for (const exp of expansions) {
      let idx = lowerText.indexOf(exp);
      while (idx !== -1) {
        addRange(idx, idx + exp.length);
        idx = lowerText.indexOf(exp, idx + 1);
      }
    }

    // Check fuzzy match on words if token is >= 4 chars and not pure number
    const normToken = normalizeSearchString(token);
    const isPureNumber = /^\d+$/.test(normToken);
    if (!isPureNumber && normToken.length >= 4) {
      const maxAllowedDist = normToken.length >= 8 ? 2 : 1;
      const wordRegex = /[a-z0-9]+/gi;
      let match: RegExpExecArray | null;
      while ((match = wordRegex.exec(text)) !== null) {
        const word = match[0];
        const normWord = normalizeSearchString(word);
        if (normWord.length >= 3 && Math.abs(normWord.length - normToken.length) <= maxAllowedDist) {
          const dist = calculateLevenshteinDistance(normToken, normWord);
          if (dist <= maxAllowedDist) {
            addRange(match.index, match.index + word.length);
          }
        }
      }
    }
  }

  // 3. If no ranges found yet, check ordered pattern match (subsequence)
  if (ranges.length === 0) {
    for (const token of tokens) {
      const normQ = normalizeSearchString(token);
      if (normQ.length > 0) {
        let qIdx = 0;
        for (let tIdx = 0; tIdx < text.length; tIdx++) {
          const char = text[tIdx].toLowerCase();
          if (/[a-z0-9]/.test(char) && char === normQ[qIdx]) {
            addRange(tIdx, tIdx + 1);
            qIdx++;
            if (qIdx === normQ.length) break;
          }
        }
      }
    }
  }

  if (ranges.length === 0) return [];

  // Sort ranges by start index, then end index
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Merge overlapping or contiguous ranges
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/**
 * Finds the closest model suggestions for "Did You Mean?" when zero results match.
 * Uses string distance and shape ratio.
 */
export function findClosestModelSuggestions(
  query: string,
  models: { modelNumber: string }[],
  limit: number = 2
): string[] {
  const cleanQ = normalizeSearchString(query);
  if (!cleanQ || cleanQ.length < 3 || models.length === 0) return [];

  const candidates: { cleanName: string; distance: number; ratio: number }[] = [];

  for (const m of models) {
    const cleanName = m.modelNumber.replace(/_\d{10,}$/, '');
    const normModel = normalizeSearchString(cleanName);
    if (!normModel) continue;

    const dist = calculateLevenshteinDistance(cleanQ, normModel);
    const maxLen = Math.max(cleanQ.length, normModel.length);
    const ratio = dist / maxLen;

    // Direct close match (e.g. 1-2 typos or ratio <= 0.38)
    if (dist <= 2 || ratio <= 0.38) {
      candidates.push({ cleanName, distance: dist, ratio });
      continue;
    }

    // Prefix/substring match if user typed model without brand prefix or with small difference
    if (normModel.length > cleanQ.length && cleanQ.length >= 4) {
      const prefixDist = calculateLevenshteinDistance(cleanQ, normModel.slice(0, cleanQ.length));
      if (prefixDist <= 1) {
        candidates.push({ cleanName, distance: prefixDist + 0.5, ratio: prefixDist / cleanQ.length });
      }
    }
  }

  candidates.sort((a, b) => a.distance - b.distance || a.ratio - b.ratio);

  const seen = new Set<string>();
  const results: string[] = [];
  for (const c of candidates) {
    if (!seen.has(c.cleanName)) {
      seen.add(c.cleanName);
      results.push(c.cleanName);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Client-safe pure search algorithms for TV Tech OS
 * Ordered Subsequence Pattern Matching & Relevance Scoring
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
 * Checks if query appears as an ordered sequence in target (left-to-right, index strictly increasing).
 * Both query and target are normalized to alphanumeric characters only.
 *
 * Example 1: Target = "samsung backlight 1" (norm: "samsungbacklight1")
 *  - "ssung"     -> TRUE
 *  - "ungback"   -> TRUE
 *  - "smuback"   -> TRUE
 *  - "backsamsu" -> FALSE
 *
 * Example 2: Target = "4-3-32" (norm: "4332")
 *  - "4332"      -> TRUE
 *  - "332"       -> TRUE
 *  - "4 3 32"    -> TRUE
 *  - "4/3/32"    -> TRUE
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
 * Computes relevance score for ranking search results.
 * Higher score = higher ranking in search output.
 */
export function calculateMatchScore(query: string, text: string): number {
  const cleanQ = query.trim().toLowerCase();
  const cleanT = text.trim().toLowerCase();

  if (!cleanQ || !cleanT) return 0;

  // Exact full match
  if (cleanT === cleanQ) return 100;

  // Starts with exact query string
  if (cleanT.startsWith(cleanQ)) return 90;

  // Contains contiguous substring
  if (cleanT.includes(cleanQ)) return 75;

  // Ordered subsequence match
  if (matchesOrderedPattern(cleanQ, cleanT)) {
    const normQ = normalizeSearchString(cleanQ);
    const normT = normalizeSearchString(cleanT);
    const densityRatio = normQ.length / Math.max(normT.length, 1);
    return Math.round(40 + densityRatio * 30);
  }

  return 0;
}

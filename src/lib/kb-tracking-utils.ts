'use client';

const BRAND_OPENS_KEY = 'tv_tech_kb_brand_opens_v1';
const MODEL_OPENS_KEY = 'tv_tech_kb_model_opens_v1';

/**
 * Increment the open count for a TV Brand
 */
export function recordBrandOpen(brandId: string): void {
  if (typeof window === 'undefined' || !brandId) return;
  try {
    const raw = localStorage.getItem(BRAND_OPENS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[brandId] = (map[brandId] || 0) + 1;
    localStorage.setItem(BRAND_OPENS_KEY, JSON.stringify(map));
  } catch {
    // Fail silently in private browsing or storage full
  }
}

/**
 * Retrieve the open count map for all TV Brands
 */
export function getBrandOpenCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(BRAND_OPENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Increment the open count for a TV Model
 */
export function recordModelOpen(modelId: string): void {
  if (typeof window === 'undefined' || !modelId) return;
  try {
    const raw = localStorage.getItem(MODEL_OPENS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[modelId] = (map[modelId] || 0) + 1;
    localStorage.setItem(MODEL_OPENS_KEY, JSON.stringify(map));
  } catch {
    // Fail silently in private browsing or storage full
  }
}

/**
 * Retrieve the open count map for all TV Models
 */
export function getModelOpenCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MODEL_OPENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ============================================================
// RD-1: Money & Currency Configuration
// ============================================================
// ISO 4217 currency, symbol, and display locale are kept separate.
// Locale changes will never accidentally modify stored currency semantics.

export const CURRENCY_CONFIG = {
  currencyCode:   'INR',   // ISO 4217 — stored monetary value currency
  currencySymbol: '₹',     // Visual symbol for UI
  locale:         'en-IN', // Formatting locale for grouping & decimals
} as const;

/**
 * Formats a monetary number into standard locale currency display string.
 * Example: 12500.5 -> "₹12,500.50"
 */
export function formatMoney(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numeric)) return '—';

  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    style: 'currency',
    currency: CURRENCY_CONFIG.currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

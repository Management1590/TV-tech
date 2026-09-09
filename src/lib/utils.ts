import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a short code for display: e.g., "A7F9" → "#A7F9", "#A7F9" → "#A7F9"
 */
export function formatShortCode(code: string | null | undefined): string {
  if (!code) return '';
  const clean = code.replace(/^#+/, '');
  return `#${clean.toUpperCase()}`;
}

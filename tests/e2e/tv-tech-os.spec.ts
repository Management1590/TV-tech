import { test, expect } from '@playwright/test';
import { matchesOrderedPattern } from '@/features/search/services/search.service';

test.describe('E2E Business Suite — TV Tech OS', () => {

  test('E2E 5: Universal Ordered-Pattern Search Algorithm Verification', async ({ request }) => {
    // 1. Verify exact, prefix, substring, and ordered-character pattern matching algorithm
    const testCases = [
      { query: 'apple', target: 'apple', expected: true },
      { query: 'apple', target: 'apple1212', expected: true },
      { query: 'apple', target: 'aaapple', expected: true },
      { query: 'apple', target: 'app232le', expected: true },
      { query: 'apple', target: 'apple_backlight', expected: true },
      { query: 'apple', target: 'ppale', expected: false },
      { query: 'apple', target: 'leppa', expected: false },
      { query: 'apple', target: 'aplpe', expected: false },
      // User Example 1: Target = "samsung backlight 1"
      { query: 'ssung', target: 'samsung backlight 1', expected: true },
      { query: 'ungback', target: 'samsung backlight 1', expected: true },
      { query: 'smuback', target: 'samsung backlight 1', expected: true },
      { query: 'backsamsu', target: 'samsung backlight 1', expected: false },
      { query: '1back', target: 'samsung backlight 1', expected: false },
      // User Example 2: Target = "4-3-32"
      { query: '4332', target: '4-3-32', expected: true },
      { query: '332', target: '4-3-32', expected: true },
      { query: '4 3 32', target: '4-3-32', expected: true },
      { query: '4/3/32', target: '4-3-32', expected: true },
    ];

    for (const tc of testCases) {
      const result = matchesOrderedPattern(tc.query, tc.target);
      expect(result, `Query '${tc.query}' vs Target '${tc.target}' should be ${tc.expected}`).toBe(tc.expected);
    }
  });

  test('E2E API Verification — Price History & Search Endpoints', async ({ request }) => {
    // Search API endpoint verification with valid session
    const searchRes = await request.get('/api/search?q=test', {
      headers: {
        Cookie: 'tv-tech-session={"userId":"00000000-0000-0000-0000-000000000000","email":"admin@modernelectronics.com","role":"ADMIN"};',
      },
    });
    expect(searchRes.status()).toBe(200);
    const searchData = await searchRes.json();
    expect(searchData.data).toHaveProperty('items');
    expect(searchData.data).toHaveProperty('folders');
  });

  test('E2E Navigation & Layout Verification', async ({ page }) => {
    // 1. Set session cookie for navigation
    await page.context().addCookies([
      {
        name: 'tv-tech-session',
        value: JSON.stringify({
          userId: '00000000-0000-0000-0000-000000000000',
          email: 'admin@modernelectronics.com',
          role: 'ADMIN',
        }),
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 2. Visit Inventory Dashboard
    await page.goto('/inventory');
    const header = page.locator('h1');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('Inventory');
  });
});

import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('FinLedger complete end-to-end user journey', async ({ page }) => {
  const uniqueEmail = `e2e_${Date.now()}@finledger.io`;

  // 1. Register
  await page.goto('/register');
  await page.getByLabel('Full Name').fill('E2E Tester');
  await page.getByLabel('Email Address').fill(uniqueEmail);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByLabel('Base Currency').selectOption('USD');
  await page.getByLabel('Workspace Type').selectOption('BUSINESS');
  await page.getByLabel('Workspace Name').fill('E2E Ledger Co');
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Financial Command Center')).toBeVisible();

  // 2. Add Personal/Business Expense
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page).toHaveURL(/\/transactions/);
  await page.getByRole('button', { name: /add transaction/i }).first().click();

  await page.getByLabel('Description').fill('AWS Hosting Bill');
  await page.getByLabel('Amount').fill('50.00');
  await page.getByRole('button', { name: /post transaction/i }).click();

  await expect(page.getByText('AWS Hosting Bill')).toBeVisible();
  await expect(page.getByText('-$50.00')).toBeVisible();

  // 3. Create Group & Split Expense -> Verify Simplified Debt -> Settle Up
  await page.getByRole('link', { name: 'Expense Groups' }).click();
  await expect(page).toHaveURL(/\/groups/);
  await page.getByRole('button', { name: /new group/i }).click();

  await page.getByLabel('Group Name').fill('Team Retreat');
  await page.getByPlaceholder('Member 2 name').fill('Bob Partner');
  await page.locator('input[placeholder="email (optional)"]').nth(1).fill('bob@partner.test');
  await page.getByRole('button', { name: /create group/i }).click();

  await page.getByRole('link', { name: /team retreat/i }).click();
  await expect(page).toHaveURL(/\/groups\/.+/);

  await page.getByRole('button', { name: /split expense/i }).click();
  await page.getByLabel('Expense Title').fill('Villa Booking');
  await page.getByLabel('Total Amount').fill('100.00');
  await expect(page.getByText('Exact Sum Validated')).toBeVisible();
  await page.getByRole('button', { name: /save split expense/i }).click();

  await expect(page.getByText('Villa Booking')).toBeVisible();
  await expect(page.getByText('$50.00').first()).toBeVisible();

  // Settle Up simplified debt
  await page.getByRole('button', { name: /settle up/i }).click();
  await page.getByRole('button', { name: /confirm settlement/i }).click();
  await expect(page.getByText('All settled up!')).toBeVisible();

  // 4. Create Client & Invoice -> Record Payment & Download PDF
  await page.getByRole('link', { name: 'Clients' }).click();
  await expect(page).toHaveURL(/\/clients/);
  await page.getByRole('button', { name: /add client/i }).first().click();
  await page.getByLabel('Contact Name').fill('Acme Client');
  await page.getByLabel('Email').fill('billing@acme.test');
  await page.getByLabel('Company').fill('Acme Corp');
  await page.getByRole('button', { name: /save client/i }).click();
  await expect(page.getByText('Acme Client')).toBeVisible();

  await page.getByRole('link', { name: 'Invoices' }).click();
  await page.getByRole('button', { name: /new invoice/i }).first().click();
  await expect(page).toHaveURL(/\/invoices\/new/);

  await page.getByPlaceholder('Service or product').fill('Architecture Sprint');
  await page.getByPlaceholder('100.00').fill('300.00');
  await page.getByRole('button', { name: /create draft invoice/i }).click();
  await expect(page).toHaveURL(/\/invoices\/(?!new).+/);

  await page.getByRole('button', { name: /mark sent/i }).click();
  await expect(page.getByText('SENT', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /record payment/i }).click();
  await page.getByRole('button', { name: /post payment/i }).click();
  await expect(page.getByText('PAID', { exact: true })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download pdf/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const downloadPath = await download.path();
  const pdfBytes = await fs.readFile(downloadPath);
  expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');

  // 5. Check Analytics & Reload Persistence
  await page.getByRole('link', { name: 'Analytics & Reports' }).click();
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByText('$50.00').first()).toBeVisible();
  await expect(page.getByText('$300.00').first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByText('$50.00').first()).toBeVisible();
  await expect(page.getByText('$300.00').first()).toBeVisible();

  // 6. Logout
  await page.getByRole('button', { name: /logout/i }).click();
  await expect(page).toHaveURL(/\/login/);
});

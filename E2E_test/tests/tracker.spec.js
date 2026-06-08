// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTeam,
  makeUniqueTeamName,
  makeUniqueUser,
  registerUser,
  safeDeleteTeam,
  setBrowserSession,
} from '../helpers/api.js';

test.describe('Tracker Page Features', () => {
  test('download skills.md button downloads SKILL.md file', async ({ page }) => {
    const owner = await registerUser(makeUniqueUser('skills_download'));
    const team = await createTeam(owner, { team_name: makeUniqueTeamName('Skills Test') });
    await setBrowserSession(page, owner);

    try {
      const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:4173';
      await page.goto(`${baseUrl}/html/tracker.html?team_id=${team.id}`);
      
      const downloadBtn = page.locator('#download-skills');
      await expect(downloadBtn).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await downloadBtn.click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe('SKILL.md');
    } finally {
      await safeDeleteTeam(owner, team.id);
    }
  });

  test('create issue with file upload via dropzone', async ({ page }) => {
    const owner = await registerUser(makeUniqueUser('dropzone_test'));
    const team = await createTeam(owner, { team_name: makeUniqueTeamName('Dropzone Test') });
    await setBrowserSession(page, owner);

    const testLogContent = `[ERROR] Database connection failed
Timestamp: 2026-06-07T10:00:00Z
Stack: at handleConnection (/app/src/db.js:42:15)`;

    try {
      const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:4173';
      await page.goto(`${baseUrl}/html/tracker.html?team_id=${team.id}`);
      await page.waitForLoadState('networkidle');
      
      const newIssueBtn = page.locator('#new-issue');
      await newIssueBtn.waitFor({ state: 'visible', timeout: 10000 });
      await newIssueBtn.click();
      
      const modal = page.locator('#new-backdrop');
      await expect(modal).toBeVisible();

      await page.fill('#new-title', 'Issue with log file upload');
      await page.fill('#new-desc', 'Testing file upload via dropzone');

      const fileInput = page.locator('#file-input');
      await fileInput.setInputFiles({
        name: 'error.log',
        mimeType: 'text/plain',
        buffer: Buffer.from(testLogContent)
      });

      const submitBtn = page.locator('#confirm-new');
      await submitBtn.click();

      // Wait for modal to close (success indicator)
      await expect(modal).not.toBeVisible({ timeout: 15000 });
      
    } finally {
      await safeDeleteTeam(owner, team.id);
    }
  });

  test('dropzone rejects non-text files', async ({ page }) => {
    const owner = await registerUser(makeUniqueUser('dropzone_reject'));
    const team = await createTeam(owner, { team_name: makeUniqueTeamName('Reject Test') });
    await setBrowserSession(page, owner);

    try {
      const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:4173';
      await page.goto(`${baseUrl}/html/tracker.html?team_id=${team.id}`);
      await page.waitForLoadState('networkidle');
      
      const newIssueBtn = page.locator('#new-issue');
      await newIssueBtn.waitFor({ state: 'visible', timeout: 10000 });
      await newIssueBtn.click();

      await page.fill('#new-title', 'Test rejected file');
      await page.fill('#new-desc', 'Testing file rejection');

      const fileInput = page.locator('#file-input');
      await fileInput.setInputFiles({
        name: 'image.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image content')
      });

      await expect(page.locator('#toast')).toContainText('Rejected', { timeout: 5000 });

    } finally {
      await safeDeleteTeam(owner, team.id);
    }
  });
});

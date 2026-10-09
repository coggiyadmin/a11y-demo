import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : {});

const open = async (path) => {
  const page = await browser.newPage();
  const response = await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  assert.equal(response?.status(), 200, `${path} must load`);
  return page;
};

try {
  {
    const page = await open('scenarios/meaningful_sequence.html');
    const items = page.locator('ol li');
    const dom = await items.allTextContents();
    const visual = await items.evaluateAll((nodes) => [...nodes]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((node) => node.textContent.trim()));
    assert.notDeepEqual(dom, visual, 'broken sequence must disagree between DOM and visual order');
    await page.close();
  }

  {
    const page = await open('scenarios/safe_meaningful_sequence.html');
    const items = page.locator('ol li');
    const dom = await items.allTextContents();
    const visual = await items.evaluateAll((nodes) => [...nodes]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .map((node) => node.textContent.trim()));
    assert.deepEqual(dom, visual, 'corrected sequence must agree between DOM and visual order');
    await page.close();
  }

  {
    const page = await open('scenarios/pointer_cancellation.html');
    await page.getByRole('button', { name: 'Cancel booking' }).dispatchEvent('pointerdown');
    assert.match(await page.locator('#pointer-status').innerText(), /cancelled/);
    await page.close();
  }

  {
    const page = await open('scenarios/safe_pointer_cancellation.html');
    const cancel = page.getByRole('button', { name: 'Cancel booking' });
    await cancel.dispatchEvent('pointerdown');
    assert.match(await page.locator('#pointer-status-safe').innerText(), /active/,
      'corrected action must not fire on pointer-down');
    await cancel.click();
    assert.match(await page.locator('#pointer-status-safe').innerText(), /cancelled/);
    await page.getByRole('button', { name: 'Undo cancellation' }).click();
    assert.match(await page.locator('#pointer-status-safe').innerText(), /active/);
    await page.close();
  }

  {
    const page = await open('scenarios/change_on_focus.html');
    await page.locator('#focus-destination').focus();
    assert.equal(await page.locator('#focus-search').isHidden(), true);
    assert.equal(await page.locator('#focus-results').isVisible(), true);
    await page.close();
  }

  {
    const page = await open('scenarios/safe_change_on_focus.html');
    await page.locator('#focus-destination-safe').focus();
    assert.equal(await page.locator('#focus-results-safe').isHidden(), true,
      'focus alone must not change context');
    await page.getByRole('button', { name: 'Search flights' }).click();
    assert.equal(await page.locator('#focus-results-safe').isVisible(), true);
    await page.close();
  }

  {
    const page = await open('scenarios/change_on_input.html');
    await page.locator('#input-destination').selectOption({ label: 'Paris' });
    assert.equal(await page.locator('#input-step-two').isVisible(), true);
    await page.close();
  }

  {
    const page = await open('scenarios/safe_change_on_input.html');
    await page.locator('#input-destination-safe').selectOption({ label: 'Paris' });
    assert.equal(await page.locator('#input-step-two-safe').isHidden(), true,
      'input alone must not change context');
    await page.getByRole('button', { name: 'Apply destination' }).click();
    assert.equal(await page.locator('#input-step-two-safe').isVisible(), true);
    await page.close();
  }

  {
    const broken = await open('scenarios/error_suggestion.html');
    assert.equal(await broken.locator('#travel-date-error').innerText(), 'Date is invalid.');
    await broken.close();
    const corrected = await open('scenarios/safe_error_suggestion.html');
    assert.match(await corrected.locator('#travel-date-error-safe').innerText(), /DD\/MM\/YYYY/);
    await corrected.close();
  }

  console.log('5 A/AA scenario pairs passed browser interaction contracts');
} finally {
  await browser.close();
}

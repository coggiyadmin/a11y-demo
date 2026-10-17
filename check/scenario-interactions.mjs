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

  // #54: the overlay is opened by its trigger, and the defect is where focus goes.
  {
    const page = await open('scenarios/overlay_focus_trap.html');
    assert.equal(await page.locator('#po').isHidden(), true, 'the popover must start closed');
    await page.locator('#fare-open').click();
    assert.equal(await page.locator('#po').isVisible(), true, 'the trigger must open the popover');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fare-open',
      'broken popover must leave focus on its trigger');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.getElementById('po').contains(document.activeElement)), false,
      'the next Tab must land behind the popover, not in it');
    await page.close();
  }

  {
    const page = await open('scenarios/safe_overlay_focus_trap.html');
    await page.locator('#fare-open').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fare-close',
      'corrected popover must move focus into itself');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#po').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'fare-open',
      'dismissing must return focus to the trigger');
    await page.close();
  }

  // #54: dragging really reorders; only the corrected page has a single-pointer path.
  for (const [file, singlePointer] of [['dragging_required', false], ['safe_dragging_required', true]]) {
    const page = await open(`scenarios/${file}.html`);
    const order = () => page.evaluate(() => [...document.querySelectorAll('#legs li')].map((li) => li.dataset.name).join('|'));
    const start = await order();
    const handle = await page.locator('#legs li:first-child .handle').boundingBox();
    const last = await page.locator('#legs li:last-child').boundingBox();
    await page.mouse.move(handle.x + 5, handle.y + 5);
    await page.mouse.down();
    await page.mouse.move(last.x + 20, last.y + last.height - 2, { steps: 8 });
    await page.mouse.up();
    assert.notEqual(await order(), start, `${file}: dragging a handle must reorder the list`);
    assert.equal(await page.locator('#legs .up, #legs .down').count() > 0, singlePointer,
      `${file}: single-pointer reorder controls ${singlePointer ? 'must' : 'must not'} exist`);
    await page.close();
  }

  // #54: 2.5.1 moved off dragging_required onto a real path-based gesture.
  for (const [file, singlePointer] of [['swipe_required', false], ['safe_swipe_required', true]]) {
    const page = await open(`scenarios/${file}.html`);
    const card = await page.locator('#fares').boundingBox();
    await page.locator('#fares').click();
    assert.match(await page.locator('#fare').innerText(), /1 of 3/, `${file}: a tap must not change fare`);
    await page.mouse.move(card.x + card.width - 20, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(card.x + 20, card.y + card.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.match(await page.locator('#fare').innerText(), /2 of 3/, `${file}: a leftward swipe must advance`);
    assert.equal(await page.locator('#fare-next').count() === 1, singlePointer,
      `${file}: a single-pointer control ${singlePointer ? 'must' : 'must not'} exist`);
    await page.close();
  }

  // #54: a real devicemotion listener; only the corrected page offers a control and an off switch.
  for (const [file, alternative] of [['motion_actuation', false], ['safe_motion_actuation', true]]) {
    const page = await open(`scenarios/${file}.html`);
    await page.evaluate(() => dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: 20, y: 0, z: 0 } })));
    assert.match(await page.locator('#seat-status').innerText(), /undone/, `${file}: shaking must undo`);
    assert.equal(await page.locator('#undo').count() === 1, alternative,
      `${file}: an Undo control ${alternative ? 'must' : 'must not'} exist`);
    await page.close();
  }

  console.log('9 scenario pairs passed browser interaction contracts');
} finally {
  await browser.close();
}

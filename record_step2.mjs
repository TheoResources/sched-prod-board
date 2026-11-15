import fs from 'fs';
import { chromium } from 'playwright';

fs.mkdirSync('./recordings', { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  recordVideo: {
    dir: './recordings',
    size: { width: 1280, height: 720 },
  },
  locale: 'en-GB',
  timezoneId: 'Europe/Berlin',
});

const page = await ctx.newPage();

console.log('Opening live board for step 2 recording...');
await page.goto('https://theoresources.github.io/sched-prod-board/app/');

// 1. Initial list loads
await page.waitForSelector('[data-testid="incident-list"] [data-testid="incident-row"]');
console.log('Board loaded');
await page.waitForTimeout(2000);

// 2. Wait for new-bar to appear (new incident arrived, list held still)
console.log('Waiting for new-bar to appear...');
await page.waitForSelector('[data-testid="new-bar"]:visible', { timeout: 20000 });
console.log('new-bar is visible! List held still.');
await page.waitForTimeout(1500);

// 3. Click new-bar to bring in new incidents
console.log('Clicking new-bar...');
await page.locator('[data-testid="new-bar"]:visible').click();
await page.waitForTimeout(1500);

// 4. Click Ack on an unacked row
const ackBtn = await page.locator('[data-testid="incident-row"] [data-testid="ack"]').first();
await ackBtn.click();
console.log('Clicked Ack');
await page.waitForSelector('[data-testid="acked"]');
console.log('Row marked acked');

// 5. Watch for 3 more seconds
await page.waitForTimeout(3000);

const video = page.video();
const rawVideoPath = await video.path();

await ctx.close();
await browser.close();

const finalVideoPath = './proof_step2.webm';
fs.copyFileSync(rawVideoPath, finalVideoPath);
console.log(`Saved proof_step2.webm (size: ${fs.statSync(finalVideoPath).size} bytes)`);

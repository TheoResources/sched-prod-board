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

let ackReceipt = null;
let ackIncidentId = null;

page.on('console', (msg) => {
  const text = msg.text();
  console.log('CONSOLE:', text);
  if (text.startsWith('ack INC-')) {
    const parts = text.split(' ');
    // Format: 'ack', id, ackedAt, receipt
    if (parts.length >= 4) {
      ackIncidentId = parts[1];
      ackReceipt = parts[3];
    }
  }
});

const startTime = Date.now();
console.log('Navigating to live board https://theoresources.github.io/sched-prod-board/app/ ...');
await page.goto('https://theoresources.github.io/sched-prod-board/app/');

// Flow 1: open-board
await page.waitForSelector('[data-testid="incident-list"] [data-testid="incident-row"]');
console.log('Board loaded with incidents');
await page.waitForTimeout(2000);

// Flow 2: ack-incident
const ackBtn = await page.waitForSelector('[data-testid="incident-row"] [data-testid="ack"]');
const ackRow = await ackBtn.evaluateHandle((el) => el.closest('[data-testid="incident-row"]'));
const rowId = await ackRow.getAttribute('data-id');

const elapsedMs = Date.now() - startTime;
const elapsedSec = Math.floor(elapsedMs / 1000);
const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
const ss = String(elapsedSec % 60).padStart(2, '0');
const atTime = `${mm}:${ss}`;

console.log(`Clicking Ack on incident ${rowId} at ${atTime}...`);
await ackBtn.click();

// Wait for acked state
await page.waitForSelector(`[data-testid="incident-row"][data-id="${rowId}"] [data-testid="acked"]`);
console.log(`Incident ${rowId} is now acked!`);

// Flow 3: watch-board
console.log('Watching board for 5 seconds to demonstrate continuous 2s refresh...');
await page.waitForTimeout(5000);

const video = page.video();
const rawVideoPath = await video.path();

await ctx.close();
await browser.close();

const finalVideoPath = './proof.webm';
fs.copyFileSync(rawVideoPath, finalVideoPath);
console.log(`Saved proof video to ${finalVideoPath} (size: ${fs.statSync(finalVideoPath).size} bytes)`);

console.log('--- RECORDING RESULT ---');
console.log('Flow: ack-incident');
console.log('At:', atTime);
console.log('Incident ID:', rowId);
console.log('Ack Receipt:', ackReceipt);
console.log('SHA: d387469');

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
let ackedAtTime = null;

page.on('console', (msg) => {
  const text = msg.text();
  console.log('CONSOLE:', text);
  if (text.startsWith('ack INC-')) {
    const parts = text.split(' ');
    if (parts.length >= 4) {
      ackIncidentId = parts[1];
      ackedAtTime = parts[2];
      ackReceipt = parts[3];
    }
  }
});

const startTime = Date.now();
console.log('Navigating to live board https://theoresources.github.io/sched-prod-board/app/ ...');
await page.goto('https://theoresources.github.io/sched-prod-board/app/');

// Wait for board to load
await page.waitForSelector('[data-testid="incident-list"] [data-testid="incident-row"]');
console.log('Board loaded');

// Find the initial top incident
const initialTopId = await page.$eval('[data-testid="incident-row"]:first-child', (el) => el.getAttribute('data-id'));
console.log('Initial top incident (what the person is intending to ack):', initialTopId);

// Hover over the Ack button of row 1 as a human aiming their cursor
const firstAckBtn = await page.$('[data-testid="incident-row"]:first-child [data-testid="ack"]');
const box = await firstAckBtn.boundingBox();
const clickX = box.x + box.width / 2;
const clickY = box.y + box.height / 2;

console.log(`Moving mouse to Ack button at (${clickX}, ${clickY})...`);
await page.mouse.move(clickX, clickY, { steps: 15 });

// Now wait for a new incident to land at the top of the board!
console.log('Waiting for a new incident to land at the top...');
const newTopId = await page.waitForFunction(
  (oldId) => {
    const el = document.querySelector('[data-testid="incident-row"]:first-child');
    if (!el) return false;
    const currentId = el.getAttribute('data-id');
    return currentId !== oldId ? currentId : false;
  },
  initialTopId,
  { timeout: 30000 },
);

const newIncidentId = await newTopId.jsonValue();
console.log(`NEW INCIDENT LANDED AT TOP: ${newIncidentId}! The list just shifted under the cursor!`);

// Click immediately as a human whose finger was already pressing the button!
const elapsedMs = Date.now() - startTime;
const elapsedSec = Math.floor(elapsedMs / 1000);
const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
const ss = String(elapsedSec % 60).padStart(2, '0');
const atTime = `${mm}:${ss}`;

console.log(`Clicking at (${clickX}, ${clickY}) at ${atTime}...`);
await page.mouse.click(clickX, clickY);

// Wait for acked state
await page.waitForSelector(`[data-testid="incident-row"][data-id="${newIncidentId}"] [data-testid="acked"]`, { timeout: 5000 });
console.log(`Incident ${newIncidentId} was clicked and marked acked! (Intended: ${initialTopId})`);

// Keep watching for 4 more seconds to demonstrate the board state
await page.waitForTimeout(4000);

const video = page.video();
const rawVideoPath = await video.path();

await ctx.close();
await browser.close();

const finalVideoPath = './proof.webm';
fs.copyFileSync(rawVideoPath, finalVideoPath);
console.log(`Saved proof video to ${finalVideoPath} (size: ${fs.statSync(finalVideoPath).size} bytes)`);

console.log('\n--- ACK RACE RESULT ---');
console.log('Intended row:', initialTopId);
console.log('Actually clicked row:', newIncidentId);
console.log('Ack Incident ID:', ackIncidentId);
console.log('Acked At:', ackedAtTime);
console.log('Ack Receipt:', ackReceipt);
console.log('Video timestamp at:', atTime);

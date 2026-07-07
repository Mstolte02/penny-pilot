#!/usr/bin/env node
// Records the Penny Pilot ad tour: headless Chrome + CDP screencast → animated GIF.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import WebSocket from 'ws';
import jpeg from 'jpeg-js';
import gifencPkg from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifencPkg;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://localhost:8090';
const OUT = process.argv[2] ?? 'penny-pilot-tour.gif';
const TOUR_SOURCE = readFileSync(new URL('./tour.js', import.meta.url), 'utf8');
const PROFILE = new URL('./chrome-ad-profile', import.meta.url).pathname;

mkdirSync(PROFILE, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${PROFILE}`,
  '--window-size=420,880',
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-first-run',
  APP_URL,
]);
chrome.on('error', (error) => {
  console.error('chrome failed to start', error);
  process.exit(1);
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function debuggerUrl() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const targets = await (await fetch('http://localhost:9223/json')).json();
      const page = targets.find((t) => t.type === 'page' && t.url.startsWith(APP_URL));
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error('Could not reach Chrome debugger');
}

const ws = new WebSocket(await debuggerUrl(), { maxPayload: 64 * 1024 * 1024 });
await new Promise((resolve) => ws.on('open', resolve));

let nextId = 1;
const pending = new Map();
const frames = [];

ws.on('message', (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
  if (message.method === 'Page.screencastFrame') {
    frames.push({
      data: message.params.data,
      timestamp: message.params.metadata.timestamp,
    });
    send('Page.screencastFrameAck', { sessionId: message.params.sessionId });
  }
});

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 360,
  height: 754,
  deviceScaleFactor: 1,
  mobile: false,
});
await sleep(4000); // let the expo bundle load and settle

// Seed the demo data, then reload so the finance store boots from it.
console.log('seeding demo data...');
const seedResult = await send('Runtime.evaluate', {
  expression: `(async () => {
    const data = await (await fetch('http://localhost:8099')).json();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('penny:db:')) localStorage.removeItem(key);
    }
    localStorage.setItem('penny:db:transactions', JSON.stringify(data['penny:db:transactions']));
    localStorage.setItem('penny:db:goals', JSON.stringify(data['penny:db:goals']));
    localStorage.setItem('penny:setupComplete', 'true');
    return 'seeded ' + data['penny:db:transactions'].length;
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log('seed result:', JSON.stringify(seedResult.result ?? seedResult));
await send('Page.reload');
await sleep(4500);
const probe = await send('Runtime.evaluate', {
  expression:
    "JSON.stringify({ url: location.pathname, briefing: !!document.querySelector('[aria-label*=\"briefing\"]'), tabs: document.querySelectorAll('a[href]').length, text: document.body.innerText.replace(/\\n+/g,' | ').slice(0, 160) })",
  returnByValue: true,
});
console.log('post-reload probe:', probe.result?.result?.value);

console.log('injecting tour and capturing frames...');
await send('Runtime.evaluate', { expression: TOUR_SOURCE, awaitPromise: false });

// Headless Chrome renders lazily, so screencast frames starve. Instead, force a
// frame ~8 times a second with captureScreenshot while the tour runs.
const started = Date.now();
let done = false;
let doneCheckAt = 0;
while (!done && Date.now() - started < 90000) {
  const shot = await send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 62,
    optimizeForSpeed: true,
  });
  if (shot.result?.data) {
    frames.push({ data: shot.result.data, timestamp: Date.now() / 1000 });
  }
  if (Date.now() - doneCheckAt > 700) {
    doneCheckAt = Date.now();
    const result = await send('Runtime.evaluate', {
      expression: 'window.__tourDone === true',
      returnByValue: true,
    });
    done = result.result?.result?.value === true;
  }
}
console.log(`tour ${done ? 'completed' : 'TIMED OUT'} — ${frames.length} raw frames`);
ws.close();
chrome.kill();

writeFileSync(new URL('./frames.json', import.meta.url), JSON.stringify(frames));
console.log(`saved frames.json (${frames.length} frames)`);

if (frames.length < 10) {
  console.error('too few frames; aborting');
  process.exit(1);
}

// ---- assemble GIF at a fixed 10fps timeline (hold last frame through gaps) ----
const FPS = 8;
const t0 = frames[0].timestamp;
const tEnd = frames[frames.length - 1].timestamp;
const frameAt = (t) => {
  let candidate = frames[0];
  for (const frame of frames) {
    if (frame.timestamp <= t) candidate = frame;
    else break;
  }
  return candidate;
};

const first = jpeg.decode(Buffer.from(frames[0].data, 'base64'), { useTArray: true });
const { width, height } = first;
console.log(`encoding ${width}x${height} @ ${FPS}fps, ${(tEnd - t0).toFixed(1)}s`);

const gif = GIFEncoder();
const stepMs = Math.round(1000 / FPS);
let encoded = 0;

// Perceptual dedup: Penny's idle float keeps every frame slightly different, so
// byte-compare never collapses anything. Instead, measure the fraction of sampled
// pixels that moved meaningfully vs the last *written* frame — under the threshold
// (idle bob only), extend that frame's delay instead of writing a new one.
const changedFraction = (a, b) => {
  let changed = 0;
  let sampled = 0;
  for (let i = 0; i < a.length; i += 16) {
    sampled++;
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    if (dr + dg + db > 48) changed++;
  }
  return changed / sampled;
};

let lastWritten = null; // decoded RGBA of the last written frame
let pendingDelay = 0;
const writeFrame = (rgba, delay) => {
  const palette = quantize(rgba, 128);
  const indexed = applyPalette(rgba, palette);
  gif.writeFrame(indexed, width, height, { palette, delay });
  encoded++;
  if (encoded % 25 === 0) console.log(`  ${encoded} frames encoded`);
};

let lastJpeg = null;
for (let t = t0; t <= tEnd; t += 1 / FPS) {
  const frame = frameAt(t);
  if (lastJpeg === frame.data) {
    pendingDelay += stepMs;
    continue;
  }
  lastJpeg = frame.data;
  const { data } = jpeg.decode(Buffer.from(frame.data, 'base64'), { useTArray: true });
  if (lastWritten) writeFrame(lastWritten, pendingDelay);
  lastWritten = data;
  pendingDelay = stepMs;
}
if (lastWritten) writeFrame(lastWritten, pendingDelay);
gif.finish();
writeFileSync(OUT, Buffer.from(gif.bytes()));
console.log(`wrote ${OUT} (${(gif.bytes().length / 1024 / 1024).toFixed(2)} MB, ${encoded} frames)`);

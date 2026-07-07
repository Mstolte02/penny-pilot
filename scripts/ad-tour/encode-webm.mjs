#!/usr/bin/env node
// Replays captured tour frames on a canvas in headless Chrome and records a WebM
// via MediaRecorder — native video encoding with zero external dependencies.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCRATCH = new URL('.', import.meta.url).pathname;
const OUT = `${SCRATCH}penny-pilot-tour.webm`;
const PORT = 8098;

const ENCODER_HTML = `<!doctype html><html><body style="margin:0;background:#111">
<canvas id="c"></canvas>
<script>
(async () => {
  const frames = await (await fetch('/frames.json')).json();
  const t0 = frames[0].timestamp;
  const duration = (frames[frames.length - 1].timestamp - t0) * 1000;

  const bitmaps = [];
  for (const frame of frames) {
    const blob = await (await fetch('data:image/jpeg;base64,' + frame.data)).blob();
    bitmaps.push({ at: (frame.timestamp - t0) * 1000, image: await createImageBitmap(blob) });
  }

  const canvas = document.getElementById('c');
  canvas.width = bitmaps[0].image.width;
  canvas.height = bitmaps[0].image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmaps[0].image, 0, 0);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2200000,
  });
  const chunks = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start();

  const start = performance.now();
  let index = 0;
  await new Promise((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      while (index + 1 < bitmaps.length && bitmaps[index + 1].at <= elapsed) index++;
      ctx.drawImage(bitmaps[index].image, 0, 0);
      if (elapsed < duration + 400) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });

  recorder.stop();
  await stopped;
  const blob = new Blob(chunks, { type: 'video/webm' });
  await fetch('/save', { method: 'POST', body: blob });
  document.title = 'ENCODE_DONE';
})();
</script></body></html>`;

const framesJson = readFileSync(`${SCRATCH}frames.json`);
let saved = false;

const server = createServer((req, res) => {
  if (req.url === '/frames.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(framesJson);
  } else if (req.url === '/save' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      writeFileSync(OUT, Buffer.concat(chunks));
      saved = true;
      res.writeHead(200).end('ok');
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(ENCODER_HTML);
  }
});
server.listen(PORT);

mkdirSync(`${SCRATCH}chrome-encode-profile`, { recursive: true });
const chrome = spawn(CHROME, [
  '--headless=new',
  `--user-data-dir=${SCRATCH}chrome-encode-profile`,
  '--window-size=500,900',
  '--disable-gpu',
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run',
  `http://localhost:${PORT}/`,
]);

const started = Date.now();
while (!saved && Date.now() - started < 120000) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
chrome.kill();
server.close();

if (saved && existsSync(OUT)) {
  const size = readFileSync(OUT).length;
  console.log(`wrote ${OUT} (${(size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.error('encode FAILED (timeout)');
  process.exit(1);
}

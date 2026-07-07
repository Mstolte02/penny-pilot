# Ad tour recorder

Generates the demo/ad recording in `docs/marketing/` — a scripted walk through the app
(Overview → briefing paging → Plan → Subscriptions → The Hangar → end card) with an
animated pointer, recorded from headless Chrome. No ffmpeg or paid tools required.

## Pieces

- `gen-demo-data.mjs` — deterministic 7-month demo dataset (categories match the
  budget template so plan lines pick it up). Serve its JSON output on port 8099.
- `tour.js` — injected into the app page: seeds the demo profile, draws a fake cursor,
  runs the storyboard, sets `window.__tourDone`.
- `record-tour.mjs` — launches headless Chrome against the dev server (port 8090),
  seeds + reloads, injects the tour, captures ~15fps JPEG frames via CDP
  `Page.captureScreenshot` (headless screencast starves without it), writes
  `frames.json` and a fallback GIF.
- `encode-webm.mjs` — replays `frames.json` on a canvas in headless Chrome and records
  it with MediaRecorder → real VP9 WebM at correct timing (~2.3 MB vs ~10 MB GIF).

## Regenerate

```sh
# 1. app dev server (expects demo on http://localhost:8090)
npx expo start --web --port 8090

# 2. demo-data server on :8099
node -e "const h=require('http'),{execSync}=require('child_process');const j=execSync('node scripts/ad-tour/gen-demo-data.mjs');h.createServer((q,s)=>{s.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});s.end(j)}).listen(8099)" &

# 3. record + encode (deps: npm i ws jpeg-js gifenc in a scratch folder, or here)
node scripts/ad-tour/record-tour.mjs docs/marketing/penny-pilot-tour.gif
node scripts/ad-tour/encode-webm.mjs   # reads frames.json next to record-tour.mjs

# then update the dates in gen-demo-data.mjs (NOW constant) when rerunning later
```

Note: `record-tour.mjs`/`encode-webm.mjs` resolve `tour.js`/`frames.json` relative to
their own location, and need `ws`, `jpeg-js`, `gifenc` installed wherever they run.

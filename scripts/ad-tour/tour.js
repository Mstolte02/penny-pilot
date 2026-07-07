// Penny Pilot ad tour — injected into the page by the recorder. Draws a fake cursor,
// walks the app, and sets window.__tourDone when finished.
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---- demo data ----
  try {
    const data = await (await fetch('http://localhost:8099')).json();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('penny:db:')) localStorage.removeItem(key);
    }
    localStorage.setItem('penny:db:transactions', JSON.stringify(data['penny:db:transactions']));
    localStorage.setItem('penny:db:goals', JSON.stringify(data['penny:db:goals']));
    localStorage.setItem('penny:setupComplete', 'true');
  } catch (e) {
    // keep going with whatever state exists
  }

  // ---- cursor ----
  const cursor = document.createElement('div');
  cursor.id = '__penny_cursor';
  cursor.style.cssText = [
    'position:fixed', 'z-index:99999', 'width:26px', 'height:26px',
    'border-radius:50%', 'background:rgba(255,255,255,0.85)',
    'border:2.5px solid #B87333', 'box-shadow:0 2px 10px rgba(0,0,0,0.45)',
    'pointer-events:none', 'left:210px', 'top:700px',
    'transition:left 0.85s cubic-bezier(.35,.9,.35,1), top 0.85s cubic-bezier(.35,.9,.35,1)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  document.body.appendChild(cursor);

  const moveTo = async (x, y, ms = 900) => {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    await sleep(ms);
  };

  const pressEffect = async () => {
    cursor.style.transition += ', transform 0.12s ease';
    cursor.style.transform = 'translate(-50%,-50%) scale(0.72)';
    await sleep(130);
    cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    await sleep(140);
  };

  const clickAt = async (element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    await moveTo(x, y);
    await pressEffect();
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1 };
    element.dispatchEvent(new PointerEvent('pointerdown', opts));
    element.dispatchEvent(new PointerEvent('pointerup', opts));
    element.dispatchEvent(new MouseEvent('click', opts));
  };

  const findText = (text) =>
    [...document.querySelectorAll('div,span')].find(
      (node) => node.children.length === 0 && node.textContent.trim() === text
    );

  const clickable = (node) => {
    let current = node;
    while (current && current !== document.body) {
      if (
        current.getAttribute?.('role') === 'button' ||
        current.tagName === 'A' ||
        current.tabIndex === 0
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return node;
  };

  // ---- storyboard ----
  await sleep(2600); // overview: count-up + entrances play

  // 1. Page the briefing
  const briefing = document.querySelector('[aria-label*="briefing"]');
  if (briefing) {
    await clickAt(briefing);
    await sleep(2100);
  }

  // 2. Plan tab → budget with icons
  const planTab = document.querySelector('a[href="/budget"]');
  if (planTab) {
    await clickAt(planTab);
    await sleep(2300);
  }

  // 3. Transactions tab → subscriptions radar
  const transactionsTab = document.querySelector('a[href="/transactions"]');
  if (transactionsTab) {
    await clickAt(transactionsTab);
    await sleep(1700);
    const subsSegment = findText('Subscriptions');
    if (subsSegment) {
      await clickAt(clickable(subsSegment));
      await sleep(2300);
    }
  }

  // 4. The Hangar via settings
  const gear = document.querySelector('[aria-label="Settings"]');
  if (gear) {
    await clickAt(clickable(gear));
    await sleep(1500);
    const enter = findText('Enter the Hangar');
    if (enter) {
      const target = clickable(enter);
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      await sleep(400);
      await clickAt(target);
      await sleep(2600);
    }
  }

  // ---- end card ----
  cursor.style.opacity = '0';
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99998',
    'background:rgba(24,17,12,0.94)', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:14px',
    'opacity:0', 'transition:opacity 0.7s ease',
    'font-family:Inter,ui-sans-serif,system-ui,sans-serif', 'text-align:center', 'padding:32px',
  ].join(';');
  overlay.innerHTML =
    '<div style="font-size:44px">🪙</div>' +
    '<div style="color:#F4E9DC;font-size:30px;font-weight:800;letter-spacing:-0.3px">Penny Pilot</div>' +
    '<div style="color:#C89B6E;font-size:16.5px;font-weight:600;max-width:300px;line-height:1.45">Real insights from your own numbers. No shame, just altitude.</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
  await sleep(2400);

  window.__tourDone = true;
})();

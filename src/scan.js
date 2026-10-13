// Scans up to five key pages of a Shopify store with axe-core.
// `browser` is a Puppeteer browser (Cloudflare Browser Rendering in production).
// axe is loaded into each page from `axeUrl`; results are compacted inside the page
// so very little data (and CPU) reaches the Worker.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const NAV_TIMEOUT = 25000;

async function runAxe(page, axeUrl) {
  const has = await page.evaluate(() => typeof window.axe !== 'undefined').catch(() => false);
  if (!has) await page.addScriptTag({ url: axeUrl });
  return page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({
      id: v.id, impact: v.impact || 'minor', help: v.help, count: v.nodes.length,
      sample: v.nodes[0] && v.nodes[0].html ? v.nodes[0].html.slice(0, 220) : '',
    }));
  }, TAGS);
}

async function open(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  // give themes a moment to render sliders, drawers and lazy content
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 6000 }).catch(() => {});
  return res;
}

async function findLinks(page, origin) {
  return page.evaluate((origin) => {
    const out = {};
    const as = Array.from(document.querySelectorAll('a[href]'));
    for (const a of as) {
      let u;
      try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
      if (u.origin !== origin) continue;
      const p = u.pathname.replace(/\/+$/, '');
      if (!out.product && /\/products\/[^/]+$/.test(p)) out.product = u.origin + p;
      if (!out.collection && /\/collections\/[^/]+$/.test(p) && !/\/collections\/(all|vendors|types)$/.test(p)) out.collection = u.origin + p;
      if (!out.contact && (/\/pages\/(contact|kontakt|contact-us|kontaktformular)/.test(p) || /^(contact|kontakt)/i.test((a.textContent || '').trim()))) out.contact = u.origin + p;
    }
    return out;
  }, origin);
}

export async function scanStore(browser, startUrl, axeUrl, { userAgent } = {}) {
  const origin = new URL(startUrl).origin;
  const page = await browser.newPage();
  await page.setBypassCSP(true);
  await page.setViewport({ width: 1280, height: 900 });
  if (userAgent) await page.setUserAgent(userAgent);
  const pages = [];
  const merged = new Map();
  const add = (label, list) => {
    for (const v of list) {
      const m = merged.get(v.id);
      if (m) { m.count += v.count; if (!m.pages.includes(label)) m.pages.push(label); if (order(v.impact) < order(m.impact)) m.impact = v.impact; }
      else merged.set(v.id, { ...v, pages: [label] });
    }
  };

  // 1. home
  let finalOrigin = origin;
  try {
    const res = await open(page, origin + '/');
    if (!res || res.status() >= 400) throw new Error('status ' + (res && res.status()));
    finalOrigin = new URL(page.url()).origin;
    if (/\/password$/.test(new URL(page.url()).pathname)) throw new Error('password');
    add('home', await runAxe(page, axeUrl));
    pages.push({ label: 'home', url: page.url(), ok: true });
  } catch (e) {
    await page.close().catch(() => {});
    const err = new Error('unreachable'); err.code = 'unreachable'; err.detail = String(e && e.message); throw err;
  }

  const links = await findLinks(page, finalOrigin).catch(() => ({}));
  const queue = [
    ['collection', links.collection],
    ['product', links.product],
    ['cart', finalOrigin + '/cart'],
    ['contact', links.contact || finalOrigin + '/pages/contact'],
  ];

  for (const [label, url] of queue) {
    let target = url;
    if (label === 'product' && !target) {
      // no product link on the home page: take one from the collection page
      const more = await findLinks(page, finalOrigin).catch(() => ({}));
      target = more.product;
    }
    if (!target) { pages.push({ label, url: null, ok: false }); continue; }
    try {
      const res = await open(page, target);
      if (!res || res.status() >= 400) throw new Error('status ' + (res && res.status()));
      add(label, await runAxe(page, axeUrl));
      pages.push({ label, url: page.url(), ok: true });
    } catch (e) {
      pages.push({ label, url: target, ok: false });
    }
  }
  await page.close().catch(() => {});
  return { host: new URL(finalOrigin).host, url: finalOrigin + '/', pages, issues: [...merged.values()] };
}

function order(i) { return { critical: 0, serious: 1, moderate: 2, minor: 3 }[i] ?? 4; }

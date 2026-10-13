// Access Fix Worker: serves the static site and runs free accessibility checks.
//   POST /api/scan        { url, email?, consent?, lang }  ->  { id }
//   GET  /api/report/:id  ->  report JSON
//   GET  /r/:id, /de/r/:id  ->  report page
//   GET  /api/leads?key=…   ->  recent leads (needs ADMIN_KEY secret)
import puppeteer from '@cloudflare/puppeteer';
import { scanStore } from './scan.js';
import { EmailMessage } from 'cloudflare:email';

const REPORT_TTL = 60 * 60 * 24 * 90; // 90 days
const HOST_CACHE_TTL = 60 * 60 * 24;  // same store re-checked at most once a day
const IP_LIMIT = 4;                   // checks per IP per hour
const UA_SUFFIX = ' AccessFixCheck/1.0 (+https://accessfix.net)';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // www -> apex
    if (url.hostname === 'www.accessfix.net') { url.hostname = 'accessfix.net'; return Response.redirect(url.toString(), 301); }

    if (path === '/api/scan' && request.method === 'POST') return handleScan(request, env, ctx, url);
    let m;
    if ((m = path.match(/^\/api\/report\/([A-Za-z0-9_-]{6,40})$/))) {
      const r = await env.REPORTS.get('r:' + m[1]);
      if (!r) return json({ error: 'not_found' }, 404);
      return new Response(r, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
    }
    if (path === '/api/leads') return handleLeads(url, env);
    if ((m = path.match(/^(\/de)?\/r\/[A-Za-z0-9_-]{4,40}\/?$/))) {
      const page = await env.ASSETS.fetch(new Request(new URL((m[1] || '') + '/report.html', url.origin)));
      return new Response(page.body, { status: 200, headers: page.headers });
    }
    if (path.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
};

function normaliseStore(input) {
  if (typeof input !== 'string') return null;
  let v = input.trim();
  if (!v || v.length > 300) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch { return null; }
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|test|example|invalid)$/.test(h)) return null;
  if (h === 'accessfix.net' || h.endsWith('.accessfix.net')) return null;
  return 'https://' + h + '/';
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}

function newId() {
  const a = new Uint8Array(9); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function handleScan(request, env, ctx, reqUrl) {
  // only accept same-origin form posts
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== reqUrl.host) return json({ error: 'forbidden' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const store = normaliseStore(body.url);
  if (!store) return json({ error: 'bad_url' }, 400);
  const email = typeof body.email === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(body.email.trim()) ? body.email.trim() : null;
  const consent = !!(email && body.consent === true);
  const lang = body.lang === 'de' ? 'de' : 'en';
  const host = new URL(store).host.replace(/^www\./, '');

  // same store checked recently: reuse that report
  const cached = await env.REPORTS.get('h:' + host);
  if (cached) {
    if (consent) ctx.waitUntil(recordLead(env, { id: cached, host, email, lang, cached: true }));
    return json({ id: cached, cached: true });
  }

  // per-IP limit (hashed IP, kept 1 hour)
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipKey = 'ip:' + await sha(ip + (env.IP_SALT || 'af'));
  const n = parseInt((await env.REPORTS.get(ipKey)) || '0', 10);
  if (n >= IP_LIMIT) return json({ error: 'rate' }, 429);
  await env.REPORTS.put(ipKey, String(n + 1), { expirationTtl: 3600 });

  // daily cap protects the browser-minutes budget
  const day = 'd:' + new Date().toISOString().slice(0, 10);
  const used = parseInt((await env.REPORTS.get(day)) || '0', 10);
  const cap = parseInt(env.DAILY_LIMIT || '12', 10);
  if (used >= cap) {
    if (consent) ctx.waitUntil(recordLead(env, { id: null, host, email, lang, queued: true }));
    return json({ error: 'daily' }, 503);
  }
  await env.REPORTS.put(day, String(used + 1), { expirationTtl: 60 * 60 * 48 });

  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const ua = (await browser.userAgent()) + UA_SUFFIX;
    const res = await scanStore(browser, store, reqUrl.origin + '/assets/vendor/axe.min.js', { userAgent: ua });
    const id = newId();
    const report = { id, ...res, lang, scannedAt: new Date().toISOString() };
    await env.REPORTS.put('r:' + id, JSON.stringify(report), { expirationTtl: REPORT_TTL });
    await env.REPORTS.put('h:' + host, id, { expirationTtl: HOST_CACHE_TTL });
    const total = res.issues.reduce((s, i) => s + i.count, 0);
    ctx.waitUntil(recordLead(env, { id, host, email: consent ? email : null, lang, total, link: reqUrl.origin + (lang === 'de' ? '/de' : '') + '/r/' + id }));
    return json({ id });
  } catch (e) {
    if (e && e.code === 'unreachable') return json({ error: 'unreachable' }, 422);
    console.error('scan failed', host, e && (e.stack || e.message));
    return json({ error: 'failed' }, 500);
  } finally {
    if (browser) ctx.waitUntil(browser.close().catch(() => {}));
  }
}

async function recordLead(env, lead) {
  const at = new Date().toISOString();
  const rec = { at, ...lead };
  try { await env.REPORTS.put('lead:' + at + ':' + (lead.id || newId()), JSON.stringify(rec), { expirationTtl: REPORT_TTL }); } catch (e) { console.error('lead store', e); }
  if (!env.NOTIFY || !env.NOTIFY_FROM || !env.NOTIFY_TO) return;
  try {
    const subject = `Access Fix check: ${lead.host}${lead.total != null ? ` (${lead.total} problems)` : ''}${lead.email ? ' + email' : ''}`;
    const text = [
      `Store: ${lead.host}`,
      lead.total != null ? `Problems found: ${lead.total}` : '',
      lead.link ? `Report: ${lead.link}` : '',
      lead.cached ? 'Re-used a report from the last 24 hours.' : '',
      lead.queued ? 'Daily limit reached: run this check manually tomorrow.' : '',
      lead.email ? `Contact (consented to one follow-up email): ${lead.email}` : 'No email left.',
      `Language: ${lead.lang}`, `Time: ${at}`,
    ].filter(Boolean).join('\r\n');
    const raw = [
      `From: Access Fix <${env.NOTIFY_FROM}>`, `To: ${env.NOTIFY_TO}`, `Subject: ${subject}`,
      `Message-ID: <${newId()}@accessfix.net>`, `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', text,
    ].join('\r\n');
    await env.NOTIFY.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw));
  } catch (e) { console.error('notify failed', e && e.message); }
}

async function handleLeads(url, env) {
  if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return json({ error: 'forbidden' }, 403);
  const list = await env.REPORTS.list({ prefix: 'lead:', limit: 200 });
  const out = [];
  for (const k of list.keys.slice(-100).reverse()) { const v = await env.REPORTS.get(k.name); if (v) out.push(JSON.parse(v)); }
  return json(out);
}

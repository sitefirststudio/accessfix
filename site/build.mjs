// Builds the static site into ./public from site/i18n.mjs.  Run: node site/build.mjs
import { T } from './i18n.mjs';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const SITE = 'https://accessfix.net';
const VER = Date.now().toString(36);
const out = (p, s) => { const f = join(PUB, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- vendor files: fonts + axe ----------
const fontDir = join(PUB, 'assets/fonts'); mkdirSync(fontDir, { recursive: true });
const fonts = [];
for (const w of [400, 600, 700, 800]) {
  const f = `atkinson-hyperlegible-next-latin-${w}-normal.woff2`;
  copyFileSync(join(ROOT, 'node_modules/@fontsource/atkinson-hyperlegible-next/files', f), join(fontDir, f));
  fonts.push(`@font-face{font-family:"Atkinson Hyperlegible Next";font-style:normal;font-weight:${w};font-display:swap;src:url(/assets/fonts/${f}) format("woff2")}`);
}
for (const w of [400, 600]) {
  const f = `atkinson-hyperlegible-mono-latin-${w}-normal.woff2`;
  copyFileSync(join(ROOT, 'node_modules/@fontsource/atkinson-hyperlegible-mono/files', f), join(fontDir, f));
  fonts.push(`@font-face{font-family:"Atkinson Hyperlegible Mono";font-style:normal;font-weight:${w};font-display:swap;src:url(/assets/fonts/${f}) format("woff2")}`);
}
out('assets/fonts.css', fonts.join('\n') + '\n');
mkdirSync(join(PUB, 'assets/vendor'), { recursive: true });
copyFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), join(PUB, 'assets/vendor/axe.min.js'));

// ---------- shared bits ----------
const cellLogo = `<span class="cell" aria-hidden="true"><i></i><i></i><i class="o"></i><i></i><i class="o"></i><i></i></span>`;
const ico = {
  code: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" fill="none" stroke="#145E66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  card: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><rect x="4" y="6" width="16" height="13" rx="2" fill="none" stroke="#145E66" stroke-width="2.2"/><path d="M4 10h16" stroke="#145E66" stroke-width="2.2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" fill="none" stroke="#145E66" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="#145E66" stroke-width="2.2" stroke-linecap="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" style="flex:none"><circle cx="12" cy="12" r="9" fill="none" stroke="#3B5559" stroke-width="2"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="#3B5559" stroke-width="2"/></svg>',
  heart: (s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" focusable="false"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z" fill="none" stroke="#0B2A2F" stroke-width="2"/></svg>`,
  sock: (w, alt) => `<svg viewBox="0 0 120 150" width="${w}" ${alt ? `role="img" aria-label="${esc(alt)}"` : 'aria-hidden="true"'} focusable="false"><path d="M42 10h30v68c0 8 4 12 12 17l24 16c9 6 6 22-7 22H72c-17 0-30-11-30-29z" fill="#2F6B4F"/><path d="M42 10h30v12H42z" fill="#24543E"/><path d="M72 112c11 0 22 1 29 3 5 1 8 8 4 12-3 3-7 4-12 4H72z" fill="#EFE6D2"/></svg>`,
};

function head(t, { title, desc, path, altPath, noindex }) {
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${path}">`}
${altPath ? `<link rel="alternate" hreflang="${t.lang}" href="${SITE}${path}">
<link rel="alternate" hreflang="${t.altLang}" href="${SITE}${altPath}">
<link rel="alternate" hreflang="x-default" href="${SITE}${t.lang === 'en' ? path : altPath}">` : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0B2A2F">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/atkinson-hyperlegible-next-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v=${VER}">
<link rel="stylesheet" href="/assets/site.css?v=${VER}">
</head>`;
}

function header(t, { altPath, onHome }) {
  const h = onHome ? '' : t.root;
  return `<a class="skip" href="#main">${t.skip}</a>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="${t.root}" aria-label="${esc(t.homeAria)}">${cellLogo}<span>Access Fix</span></a>
    <nav aria-label="${esc(t.nav.label)}" class="navlinks">
      <a href="${h}#see">${t.nav.see}</a>
      <a href="${h}#how">${t.nav.how}</a>
      <a href="${h}#pricing">${t.nav.pricing}</a>
      <a href="${h}#agencies">${t.nav.agencies}</a>
      <a href="${h}#faq">${t.nav.faq}</a>
    </nav>
    <a class="lang" href="${altPath}" hreflang="${t.altLang}" lang="${t.altLang}" aria-label="${esc(t.nav.langAria)}">${t.altShort}</a>
    <a class="btn" href="${h}#check">${t.nav.cta}</a>
  </div>
</header>`;
}

function footer(t, { onHome }) {
  const h = onHome ? '' : t.root;
  const f = t.foot;
  return `<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <p style="font-weight:800;font-size:21px;margin-bottom:8px">Access Fix</p>
      <p class="muted" style="max-width:34ch">${f.blurb}</p>
    </div>
    <div>
      <h2>${f.service}</h2>
      <ul><li><a href="${h}#check">${f.links.check}</a></li><li><a href="${h}#pricing">${f.links.pricing}</a></li><li><a href="${h}#agencies">${f.links.agencies}</a></li><li><a href="${t.root}r/example">${f.links.example}</a></li></ul>
    </div>
    <div>
      <h2>${f.contact}</h2>
      <ul><li><a href="mailto:hello@accessfix.net">hello@accessfix.net</a></li><li class="muted">${f.replies}</li></ul>
    </div>
    <div>
      <h2>${f.legal}</h2>
      <ul>${f.legalLinks.map(([l, u]) => `<li><a href="${u}">${l}</a></li>`).join('')}</ul>
    </div>
  </div>
  <div class="wrap end">${f.end}</div>
</footer>`;
}

// ---------- landing page ----------
function landing(t) {
  const altPath = t.alt;
  const S = t.sim, H = t.hero;
  const sizes = S.sizes.map(([l, a], i) => `<span class="szw"><button type="button" class="sz${i === 1 ? ' picked kf' : i === 2 ? ' out' : ''}" aria-label="${esc(a)}"${i === 1 ? ' aria-pressed="true"' : ''} data-t="${l}"></button><span class="tag" aria-hidden="true" data-b="34×26" data-a="72×48"></span></span>`).join('');
  const clientStrings = {
    js: t.js, progress: t.progress, root: t.root,
    sim: { modes: S.modes.map(([id, label, b, a]) => ({ id, label, b, a })), tBefore: S.tBefore, tAfter: S.tAfter, listen: S.listen, stop: S.stop, speechLang: S.speechLang },
  };
  return `${head(t, { title: t.title, desc: t.desc, path: t.root, altPath })}
<body>
${header(t, { altPath, onHome: true })}
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><filter id="deut"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0"/></filter></svg>
<main id="main">

<section class="hero" id="top">
  <div class="wrap hero-grid">
    <div>
      <p class="pill"><b>${H.pillTag}</b>${H.pill}</p>
      <h1>${H.h1}</h1>
      <p class="lead">${H.lead}</p>
      <form id="check" class="check" novalidate aria-label="${esc(H.formAria)}">
        <label for="af-url">${H.urlLabel}</label>
        <div class="field">
          ${ico.globe}
          <input id="af-url" name="url" type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="${esc(H.urlPh)}" required aria-describedby="af-note af-err">
          <button class="btn" type="submit" id="af-go">${H.submit}</button>
        </div>
        <div class="email-row">
          <label for="af-email">${H.emailLabel}</label>
          <input id="af-email" name="email" type="email" autocomplete="email" placeholder="${esc(H.emailPh)}" aria-describedby="af-err">
        </div>
        <div class="consent"><input id="af-consent" name="consent" type="checkbox"><label for="af-consent">${H.consent}</label></div>
        <p class="note" id="af-note">${H.note}</p>
        <p class="error" id="af-err" role="alert"></p>
      </form>
      <ul class="facts">
        <li>${ico.code}${H.facts[0]}</li><li>${ico.card}${H.facts[1]}</li><li>${ico.shield}${H.facts[2]}</li>
      </ul>
    </div>
    <div class="visual" aria-hidden="true">
      <div class="paving"></div>
      <div class="browser">
        <div class="bbar"><i></i><i></i><i></i><span>nordlicht-socks.com/products/merino-crew</span></div>
        <div class="bbody">
          <div class="scanline"></div>
          <div class="mimg">${ico.sock('62%')}<span style="position:absolute;top:10px;left:10px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#F7E08A;color:#fff">${t.inspector.newBadge}</span><span class="ring" style="inset:-6px"></span></div>
          <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
            <div style="font-weight:800;font-size:20px;line-height:1.15">${t.inspector.product}</div>
            <div style="position:relative;color:#BDC3C2;font-size:14px">${t.inspector.colour}<span class="ring s" style="inset:-4px -8px"></span></div>
            <div style="font-weight:800;font-size:22px"><span style="color:#5F7174;text-decoration:line-through;font-weight:400;font-size:15px">€24</span> €19</div>
            <div style="position:relative;display:flex;gap:6px">
              <span style="font-size:11px;border:1px solid #BDC3C2;border-radius:4px;padding:3px 5px">35–38</span>
              <span style="font-size:11px;background:#3BA55C;color:#fff;border-radius:4px;padding:3px 5px">39–42</span>
              <span style="font-size:11px;border:1px solid #CC4B4B;color:#CC4B4B;border-radius:4px;padding:3px 5px">43–46</span>
              <span class="ring s" style="inset:-6px"></span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
              <span style="flex:1;background:#0B2A2F;color:#fff;border-radius:999px;text-align:center;font-weight:700;font-size:14px;padding:11px 0">${t.inspector.addToCart}</span>
              <span style="position:relative;width:28px;height:28px;border:1px solid #0B2A2F;border-radius:50%;display:grid;place-items:center">${ico.heart(13)}<span class="ring" style="inset:-7px"></span></span>
            </div>
          </div>
        </div>
        <div class="mstatus"><span>${t.inspector.status}</span><span style="color:#B9CDCB">${t.inspector.typical}</span></div>
      </div>
      <div class="pinx" style="top:6px;left:-8px"><span class="sev">${t.sev.critical}</span>${t.pins[0]}</div>
      <div class="pinx" style="top:168px;right:-36px"><span class="sev serious">${t.sev.serious}</span>${t.pins[1]}</div>
      <div class="pinx" style="top:300px;right:-54px"><span class="sev serious">${t.sev.serious}</span>${t.pins[2]}</div>
      <div class="pinx" style="bottom:2px;right:10px"><span class="sev">${t.sev.critical}</span>${t.pins[3]}</div>
    </div>
  </div>
</section>

<section class="progress" id="progress" hidden tabindex="-1" aria-labelledby="progress-h">
  <div class="wrap progress-row">
    <div>
      <h2 id="progress-h">${t.progress.h}</h2>
      <p class="muted">${t.progress.p}</p>
      <ol class="psteps">${t.progress.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    </div>
    <a class="btn ghost" href="${t.root}r/example" target="_blank" rel="noopener">${t.progress.example}</a>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2">${t.band.h}</h2><p>${t.band.p}</p></div>
    <div class="stats">${t.band.stats.map(([b, p], i) => `<div><p class="big"${i === 0 ? ' style="color:var(--signal)"' : ''}>${b}</p><p>${p}</p></div>`).join('')}</div>
  </div>
</section>

<section class="sim" id="see" aria-labelledby="see-h">
  <div class="wrap">
    <div style="max-width:760px">
      <h2 class="h2" id="see-h" style="margin-bottom:14px">${S.h}</h2>
      <p class="lead">${S.lead}</p>
    </div>
    <div class="modes" role="group" aria-label="${esc(S.modesAria)}">
      ${S.modes.map(([id, label]) => `<button type="button" class="mode" data-mode="${id}" aria-pressed="${id === 'reader'}">${label}</button>`).join('\n      ')}
    </div>
    <div class="lab v-before m-reader" id="sim">
      <div class="stage">
        <div class="stagebar">
          <div class="seg" role="group" aria-label="${esc(S.verAria)}">
            <button type="button" data-ver="before" aria-pressed="true">${S.before}</button>
            <button type="button" data-ver="after" aria-pressed="false">${S.after}</button>
          </div>
          <span class="verdict" id="sim-verdict" aria-live="polite"></span>
        </div>
        <article class="card" aria-label="${esc(S.cardAria)}">
          <div class="cimg">${ico.sock('58%', S.imgAlt)}<span class="cbadge" data-t="${esc(t.inspector.newBadge)}"></span></div>
          <div class="cbody">
            <h3>${S.name}</h3>
            <p class="ccol" data-t="${esc(S.colour)}"></p>
            <p class="cprice"><s data-t="€24"></s> €19</p>
            <div class="sizes"><span style="font-weight:700">${S.size}</span>${sizes}</div>
            <p class="cstock"><span class="cdot" aria-hidden="true"></span><span>${S.stock}</span></p>
            <div class="cact">
              <button type="button" class="cadd kf">${S.add}</button>
              <span class="szw"><button type="button" class="cwish" aria-label="${esc(S.wish)}">${ico.heart(22)}</button><span class="tag" aria-hidden="true" data-b="28×28" data-a="52×52"></span></span>
            </div>
          </div>
        </article>
      </div>
      <div class="readout">
        <p class="mt" id="sim-mt"></p>
        <h3 id="sim-title"></h3>
        <p id="sim-body"></p>
        <ol class="transcript" id="sim-tr"></ol>
        <button type="button" class="speak" id="sim-speak" hidden></button>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="how" aria-labelledby="how-h">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2" id="how-h">${t.how.h}</h2><p class="muted">${t.how.p}</p></div>
    <ol class="steps">${t.how.steps.map(([h, p, w], i) => `
      <li><span class="num${i === 3 ? ' last' : ''}" aria-hidden="true">${i + 1}</span><h3>${h}</h3><p class="muted">${p}</p><p class="when">${w}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="sec" style="padding-top:0" aria-labelledby="cmp-h">
  <div class="wrap cmp">
    <div>
      <h2 class="h2" id="cmp-h" style="margin-bottom:20px">${t.cmp.h}</h2>
      <p class="muted" style="margin-bottom:18px">${t.cmp.p1}</p>
      <p class="muted">${t.cmp.p2}</p>
      <div class="code">
        <div><p class="lbl">${t.cmp.before}</p><pre>&lt;button class="header__icon"&gt;
  &lt;svg&gt;…&lt;/svg&gt;
&lt;/button&gt;</pre><p class="say">${t.cmp.sayBefore}</p></div>
        <div class="after"><p class="lbl">${t.cmp.after}</p><pre>&lt;button class="header__icon"
  aria-label="${t.cmp.ariaCart}"&gt;
  &lt;svg aria-hidden="true"&gt;…&lt;/svg&gt;
&lt;/button&gt;</pre><p class="say">${t.cmp.sayAfter}</p></div>
      </div>
    </div>
    <div class="tablebox">
      <table class="t">
        <caption>${t.cmp.caption}</caption>
        <thead><tr>${t.cmp.cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
        <tbody>${t.cmp.rows.map(([a, b, c]) => `<tr><th scope="row">${a}</th><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </div>
</section>

<section class="sec pricing" id="pricing" aria-labelledby="pricing-h">
  <div class="wrap">
    <div class="sec-head"><h2 class="h2" id="pricing-h">${t.pricing.h}</h2><p class="muted">${t.pricing.p}</p></div>
    <div class="plans">${t.pricing.plans.map(([h, sub, price, per, items, btn, href], i) => `
      <div class="plan${i === 1 ? ' main' : ''}">${i === 1 ? `<span class="flag">${t.pricing.flag}</span>` : ''}
        <h3>${h}</h3><p class="sub">${sub}</p>
        <p class="price">${price}${per ? `<small>${t.pricing.month}</small>` : ''}</p>
        <ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>
        <a class="btn${i === 1 ? ' yellow' : ' ghost'}" href="${href}">${btn}</a>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="sec" id="agencies" aria-labelledby="ag-h">
  <div class="wrap agency">
    <div><h2 id="ag-h">${t.agency.h}</h2><p class="muted">${t.agency.p}</p></div>
    <a class="btn" href="mailto:hello@accessfix.net?subject=${t.agency.subject}">${t.agency.btn}</a>
  </div>
</section>

<section class="law" aria-labelledby="law-h">
  <div class="wrap law-grid">
    <h2 class="h2" id="law-h">${t.law.h}</h2>
    <div>
      <div class="box"><dl>${t.law.items.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>
        <p class="fine">${t.law.fine}</p></div>
    </div>
  </div>
</section>

<section class="sec" id="faq" aria-labelledby="faq-h">
  <div class="wrap faq-grid">
    <div><h2 class="h2" id="faq-h" style="margin-bottom:16px">${t.faq.h}</h2><p class="muted">${t.faq.p}</p></div>
    <div class="faqs">${t.faq.items.map(([q, a]) => `
      <details><summary>${q}</summary><p>${a}</p></details>`).join('')}
    </div>
  </div>
</section>

<section class="sec" style="padding-top:0">
  <div class="wrap cta">
    <h2>${t.cta.h}</h2>
    <p>${t.cta.p}</p>
    <a class="btn yellow" href="#check" style="min-height:58px;padding:0 32px;font-size:19px">${t.cta.btn}</a>
  </div>
</section>
</main>
${footer(t, { onHome: true })}
<script type="application/json" id="af-i18n">${JSON.stringify(clientStrings).replace(/</g, '\\u003c')}</script>
<script src="/assets/site.js?v=${VER}" defer></script>
</body>
</html>
`;
}

// ---------- report page ----------
function reportPage(t) {
  const r = t.report;
  const strings = {
    ...r,
    h1one: r.h1(1), h1: r.h1('{n}'), split: r.split('{c}', '{s}', '{m}'),
    hoursOne: r.hours(1), hours: r.hours('{h}'), methodP: r.methodP('{pages}'),
    sprintH: r.sprintH('{n}'), subject: r.subject('{h}'),
    sev: t.sev, lang: t.lang, locale: t.locale, root: t.root,
  };
  return `${head(t, { title: r.title + ' | Access Fix', desc: t.desc, path: t.root + 'report.html', noindex: true })}
<body class="rp">
<a class="skip" href="#main">${t.skip}</a>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="${t.root}" aria-label="${esc(t.homeAria)}">${cellLogo}<span>Access Fix</span></a>
    <button type="button" class="btn ghost rp-copy" id="rp-copy">${r.copy}</button>
    <button type="button" class="btn ghost rp-print" id="rp-print">${r.print}</button>
  </div>
</header>
<main id="main">
  <div id="rp-root" aria-live="polite"><div class="wrap rp-loading"><p>${r.loading}</p></div></div>
</main>
${footer(t, { onHome: false })}
<script type="application/json" id="af-i18n">${JSON.stringify(strings).replace(/</g, '\\u003c')}</script>
<script src="/assets/rules.js?v=${VER}" defer></script>
<script src="/assets/report.js?v=${VER}" defer></script>
</body>
</html>
`;
}

// ---------- legal pages ----------
const F = (s) => `<span class="fill">${s}</span>`;
const LEGAL = {
  en: {
    impressum: `<h1>Impressum</h1>
<p>Information under § 5 of the German Digital Services Act (DDG) and Article 5 of the EU e-Commerce Directive.</p>
<h2>Service provider</h2>
<p>Site First Studio<br>${F('[Full legal name of owner or company]')}<br>${F('[Street and number]')}<br>${F('[Postcode] Budapest, Hungary')}</p>
<h2>Contact</h2>
<p>Email: <a href="mailto:hello@accessfix.net">hello@accessfix.net</a><br>Phone: ${F('[Phone number]')}</p>
<h2>Registration and tax</h2>
<p>${F('[Company register and number, or sole-trader registration number]')}<br>VAT ID: ${F('[EU VAT number, e.g. HU12345678]')}</p>
<h2>Responsible for content</h2>
<p>${F('[Full name]')}, address as above.</p>
<h2>Online dispute resolution</h2>
<p>We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration board. Our services are offered to businesses only.</p>`,
    privacy: `<h1>Privacy notice</h1>
<p>Last updated: 12 October 2026</p>
<h2>Who is responsible</h2>
<p>Site First Studio, ${F('[Full legal name, address]')}, Budapest, Hungary. Email: <a href="mailto:hello@accessfix.net">hello@accessfix.net</a>.</p>
<h2>What we process and why</h2>
<ul>
<li><strong>Store address you enter.</strong> We load the public pages of that store and save the check result for 90 days so you can open and share your report. Legal basis: Art. 6(1)(b) GDPR (providing the check you asked for).</li>
<li><strong>Your email, only if you give it and tick the box.</strong> We use it to write to you once about the report. Legal basis: your consent, Art. 6(1)(a) GDPR. You can withdraw consent at any time by writing to us; we then delete the address.</li>
<li><strong>IP address.</strong> To stop abuse we count checks per IP address. We store only a one-way hash of the address, and delete it after one hour. Legal basis: Art. 6(1)(f) GDPR (protecting the service).</li>
<li><strong>Server logs.</strong> Our host may keep technical access logs for security for a short period.</li>
</ul>
<h2>No cookies, no tracking</h2>
<p>This website sets no cookies and uses no analytics or advertising tools. Fonts are served from our own domain.</p>
<h2>Processors</h2>
<p>Hosting, the page-loading browser and data storage: Cloudflare, Inc. (EU-US Data Privacy Framework and standard contractual clauses). Internal notifications about new checks: Google (Gmail). Both act on our instructions.</p>
<h2>Your rights</h2>
<p>You can ask for access, correction, deletion, restriction or a copy of your data, and object to processing. Write to hello@accessfix.net. You can also complain to a data protection authority, for example the Hungarian authority NAIH (naih.hu) or the authority where you live.</p>`,
    a11y: `<h1>Accessibility statement</h1>
<p>Last reviewed: 12 October 2026</p>
<p>We want everyone to be able to use accessfix.net. This website is designed to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
<h2>How we test</h2>
<p>Every page is tested with the axe-core engine, by keyboard only and with a screen reader before release. The typeface, Atkinson Hyperlegible, was designed for readers with low vision.</p>
<h2>Known limitations</h2>
<ul>
<li>The “Shop the way your customers do” demonstration deliberately shows an inaccessible product card when “Most stores today” is selected. This is to show the problems we fix. The explanation next to it and the “After our fixes” version are fully accessible.</li>
<li>Reports describe third-party stores and quote short code snippets from them as they are.</li>
</ul>
<h2>Feedback and contact</h2>
<p>If something on this website is hard to use, write to <a href="mailto:hello@accessfix.net">hello@accessfix.net</a>. We reply within one working day and send you the content in a form you can use.</p>`,
  },
  de: {
    impressum: `<h1>Impressum</h1>
<p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).</p>
<h2>Anbieter</h2>
<p>Site First Studio<br>${F('[Vollständiger Name des Inhabers oder der Firma]')}<br>${F('[Straße und Hausnummer]')}<br>${F('[PLZ] Budapest, Ungarn')}</p>
<h2>Kontakt</h2>
<p>E-Mail: <a href="mailto:hello@accessfix.net">hello@accessfix.net</a><br>Telefon: ${F('[Telefonnummer]')}</p>
<h2>Register und Steuern</h2>
<p>${F('[Handelsregister und Nummer bzw. Registriernummer als Einzelunternehmer]')}<br>USt-IdNr.: ${F('[EU-USt-IdNr., z. B. HU12345678]')}</p>
<h2>Verantwortlich für den Inhalt</h2>
<p>${F('[Vollständiger Name]')}, Anschrift wie oben.</p>
<h2>Verbraucherstreitbeilegung</h2>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Unsere Leistungen richten sich ausschließlich an Unternehmen.</p>`,
    privacy: `<h1>Datenschutzerklärung</h1>
<p>Stand: 12. Oktober 2026</p>
<h2>Verantwortlicher</h2>
<p>Site First Studio, ${F('[Vollständiger Name, Anschrift]')}, Budapest, Ungarn. E-Mail: <a href="mailto:hello@accessfix.net">hello@accessfix.net</a>.</p>
<h2>Was wir verarbeiten und warum</h2>
<ul>
<li><strong>Die eingegebene Shop-Adresse.</strong> Wir laden die öffentlichen Seiten dieses Shops und speichern das Ergebnis 90 Tage, damit Sie Ihren Bericht öffnen und teilen können. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Durchführung des angefragten Checks).</li>
<li><strong>Ihre E-Mail-Adresse, nur wenn Sie sie angeben und das Häkchen setzen.</strong> Wir schreiben Ihnen damit einmalig zu Ihrem Bericht. Rechtsgrundlage: Ihre Einwilligung, Art. 6 Abs. 1 lit. a DSGVO. Sie können die Einwilligung jederzeit per E-Mail widerrufen; wir löschen die Adresse dann.</li>
<li><strong>IP-Adresse.</strong> Zum Schutz vor Missbrauch zählen wir Checks pro IP-Adresse. Wir speichern nur einen Einweg-Hash der Adresse und löschen ihn nach einer Stunde. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz des Dienstes).</li>
<li><strong>Server-Logs.</strong> Unser Hoster kann technische Zugriffsprotokolle für kurze Zeit zu Sicherheitszwecken speichern.</li>
</ul>
<h2>Keine Cookies, kein Tracking</h2>
<p>Diese Website setzt keine Cookies und nutzt keine Analyse- oder Werbewerkzeuge. Schriften werden von unserer eigenen Domain geladen.</p>
<h2>Auftragsverarbeiter</h2>
<p>Hosting, der Browser zum Laden der Seiten und die Datenspeicherung: Cloudflare, Inc. (EU-US Data Privacy Framework und Standardvertragsklauseln). Interne Benachrichtigungen über neue Checks: Google (Gmail). Beide handeln nach unserer Weisung.</p>
<h2>Ihre Rechte</h2>
<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Schreiben Sie an hello@accessfix.net. Sie können sich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, etwa bei der ungarischen Behörde NAIH (naih.hu) oder der Behörde Ihres Wohnorts.</p>`,
    a11y: `<h1>Erklärung zur Barrierefreiheit</h1>
<p>Zuletzt geprüft: 12. Oktober 2026</p>
<p>Alle sollen accessfix.net nutzen können. Diese Website ist so gestaltet, dass sie die Web Content Accessibility Guidelines (WCAG) 2.2 auf Stufe AA erfüllt.</p>
<h2>So prüfen wir</h2>
<p>Jede Seite wird vor der Veröffentlichung mit der axe-core-Engine, nur mit Tastatur und mit einem Screenreader getestet. Die Schrift Atkinson Hyperlegible wurde für Menschen mit Sehschwäche entwickelt.</p>
<h2>Bekannte Einschränkungen</h2>
<ul>
<li>Die Demonstration „Einkaufen wie Ihre Kundschaft“ zeigt absichtlich eine nicht barrierefreie Produktkarte, wenn „Die meisten Shops heute“ gewählt ist. So werden die Probleme sichtbar, die wir beheben. Die Erklärung daneben und die Version „Nach unseren Korrekturen“ sind vollständig barrierefrei.</li>
<li>Berichte beschreiben fremde Shops und zitieren kurze Code-Ausschnitte daraus unverändert.</li>
</ul>
<h2>Feedback und Kontakt</h2>
<p>Wenn Ihnen auf dieser Website etwas schwerfällt, schreiben Sie an <a href="mailto:hello@accessfix.net">hello@accessfix.net</a>. Wir antworten innerhalb eines Werktags und senden Ihnen die Inhalte in einer für Sie nutzbaren Form.</p>
<h2>Durchsetzungsverfahren</h2>
<p>Zuständig für die Marktüberwachung nach dem BFSG ist die Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF) in Magdeburg.</p>`,
  },
};

function legalPage(t, key) {
  const p = t.pagesLegal[key];
  const other = T[t.altLang].pagesLegal[key];
  const path = t.root + p.file, altPath = T[t.altLang].root + other.file;
  return `${head(t, { title: `${p.title} | Access Fix`, desc: t.desc, path, altPath })}
<body>
${header(t, { altPath, onHome: false })}
<main id="main" class="doc"><div class="wrap">
${LEGAL[t.lang][key]}
</div></main>
${footer(t, { onHome: false })}
</body>
</html>
`;
}

// ---------- example report data ----------
const example = {
  id: 'example', example: true, host: 'nordlicht-socks.com', url: 'https://nordlicht-socks.com/', scannedAt: '2026-10-12T09:00:00Z',
  pages: ['home', 'collection', 'product', 'cart', 'contact'].map((label) => ({ label, url: 'https://nordlicht-socks.com/', ok: true })),
  issues: [
    { id: 'button-name', impact: 'critical', count: 8, pages: ['home', 'cart'], help: 'Buttons must have discernible text', sample: '<button class="header__icon header__icon--cart">' },
    { id: 'image-alt', impact: 'critical', count: 2, pages: ['product', 'collection'], help: 'Images must have alternate text', sample: '<img src="//nordlicht-socks.com/cdn/shop/files/merino-crew.jpg">' },
    { id: 'color-contrast', impact: 'serious', count: 17, pages: ['home', 'collection', 'product', 'cart'], help: 'Elements must meet minimum color contrast ratio thresholds', sample: '<span class="badge badge--sale">' },
    { id: 'link-name', impact: 'serious', count: 4, pages: ['home', 'cart'], help: 'Links must have discernible text', sample: '<a href="https://instagram.com/nordlicht" class="social-link">' },
    { id: 'target-size', impact: 'serious', count: 2, pages: ['home', 'product'], help: 'All touch targets must be 24px large, or leave sufficient space', sample: '<button class="slider-button slider-button--next">' },
    { id: 'heading-order', impact: 'moderate', count: 12, pages: ['product', 'contact'], help: 'Heading levels should only increase by one', sample: '<h4 class="footer-block__heading">' },
  ],
};
out('assets/example.json', JSON.stringify(example));

// ---------- write everything ----------
for (const t of Object.values(T)) {
  out(t.root.slice(1) + 'index.html', landing(t));
  out(t.root.slice(1) + 'report.html', reportPage(t));
  for (const key of ['impressum', 'privacy', 'a11y']) out(t.root.slice(1) + t.pagesLegal[key].file, legalPage(t, key));
}
out('404.html', `${head(T.en, { title: 'Page not found | Access Fix', desc: T.en.desc, path: '/404', noindex: true })}
<body>
${header(T.en, { altPath: '/de/', onHome: false })}
<main id="main" class="doc"><div class="wrap">
<h1>Page not found</h1><p>This page doesn’t exist, or it has moved. <a href="/">Go to the home page</a>.</p>
<h1 lang="de" style="margin-top:48px">Seite nicht gefunden</h1><p lang="de">Diese Seite gibt es nicht oder sie wurde verschoben. <a href="/de/">Zur Startseite</a>.</p>
</div></main>
${footer(T.en, { onHome: false })}
</body>
</html>
`);
out('favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#FFCB2E"/><g fill="#0B2A2F"><circle cx="11" cy="8" r="3"/><circle cx="21" cy="8" r="3"/><circle cx="21" cy="16" r="3"/><circle cx="21" cy="24" r="3"/></g><g fill="none" stroke="#0B2A2F" stroke-opacity=".4" stroke-width="1.3"><circle cx="11" cy="16" r="2.4"/><circle cx="11" cy="24" r="2.4"/></g></svg>');
out('robots.txt', `User-agent: *\nAllow: /\nDisallow: /r/\nDisallow: /de/r/\nSitemap: ${SITE}/sitemap.xml\n`);
const urls = ['/', '/de/', '/impressum.html', '/privacy.html', '/accessibility.html', '/de/impressum.html', '/de/datenschutz.html', '/de/barrierefreiheit.html'];
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
out('_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
console.log('Built site into', PUB);

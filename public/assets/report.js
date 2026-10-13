/* Access Fix report page: loads /api/report/:id (or the example) and renders it */
(function () {
  'use strict';
  var R = JSON.parse(document.getElementById('af-i18n').textContent);
  var RULES = window.AF_RULES || {};
  var root = document.getElementById('rp-root');
  var L = R.lang;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ''; }); }

  var m = location.pathname.match(/\/r\/([A-Za-z0-9_-]{4,40})\/?$/);
  var id = m ? m[1] : new URLSearchParams(location.search).get('id');
  if (!id) return notFound();

  var src = id === 'example' ? '/assets/example.json' : '/api/report/' + encodeURIComponent(id);
  fetch(src).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(render).catch(notFound);

  function notFound() {
    root.innerHTML = '<div class="wrap rp-loading"><h1 class="h2" style="margin-bottom:18px">' + esc(R.notFound) + '</h1><a class="btn" href="' + R.root + '#check">' + esc(R.again) + '</a></div>';
  }

  function render(d) {
    var issues = (d.issues || []).slice();
    var order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    issues.sort(function (a, b) { return (order[a.impact] - order[b.impact]) || (b.count - a.count); });
    var tot = { critical: 0, serious: 0, moderate: 0, minor: 0, all: 0 };
    var hours = 0;
    issues.forEach(function (i) {
      tot[i.impact] = (tot[i.impact] || 0) + i.count; tot.all += i.count;
      var h = (RULES[i.id] && RULES[i.id].h) || 1;
      i.hrs = Math.max(1, Math.round(h + Math.floor(i.count / 10) * 0.5));
      hours += h + Math.floor(i.count / 10) * 0.5;
    });
    var days = tot.all ? Math.max(1, Math.ceil(hours / 5)) : 0;
    var okPages = (d.pages || []).filter(function (p) { return p.ok; });
    var pagesWith = {};
    issues.forEach(function (i) { (i.pages || []).forEach(function (p) { pagesWith[p] = 1; }); });
    var nWith = Object.keys(pagesWith).length;
    var date = new Date(d.scannedAt).toLocaleDateString(R.locale, { day: 'numeric', month: 'long', year: 'numeric' });
    var host = d.host || '';
    document.title = host + ': ' + R.title + ' | Access Fix';

    var full = tot.all > 60 || issues.length > 15 || tot.all === 0;
    var price = full ? '€990' : '€490';
    if (L === 'de') price = full ? '990 €' : '490 €';
    var qH = tot.all === 0 ? R.zeroH : full ? R.fullH : fill(R.sprintH, { n: issues.length });
    var qList = full ? R.fullList : R.sprintList;
    var mail = 'mailto:hello@accessfix.net?subject=' + encodeURIComponent(fill(R.subject, { h: host })) + '&body=' + encodeURIComponent(location.href);

    var c = tot.critical, s = tot.serious, mm = tot.moderate + tot.minor, all = tot.all || 1;
    var donut = 'conic-gradient(var(--critical) 0 ' + (c / all * 100) + '%, var(--serious) 0 ' + ((c + s) / all * 100) + '%, #E0A400 0 100%)';
    if (!tot.all) donut = 'var(--ok)';
    var pageNames = okPages.map(function (p) { return R.pages[p.label] || p.label; }).join(', ');
    var failed = (d.pages || []).filter(function (p) { return !p.ok; }).map(function (p) { return R.pages[p.label] || p.label; });

    var h = '';
    h += '<section class="rp-hero"><div class="wrap">';
    if (d.example) h += '<p class="rp-ex">' + esc(R.example) + '</p>';
    h += '<div class="rp-top"><div style="max-width:760px"><p class="rp-meta">' + esc(host) + ', ' + esc(R.checked) + ' ' + esc(date) + '</p>';
    h += '<h1>' + esc(tot.all ? (tot.all === 1 ? R.h1one : fill(R.h1, { n: tot.all })) : R.h1zero) + '</h1>';
    if (!tot.all) h += '<p class="muted" style="margin-top:14px;max-width:60ch">' + esc(R.zeroP) + '</p>';
    h += '</div><div class="rp-donutbox"><div class="rp-donut" aria-hidden="true" style="background:' + donut + '"><span>' + tot.all + '</span></div>';
    h += '<p class="muted">' + esc(fill(R.split, { c: c, s: s, m: mm })) + '</p></div></div>';
    h += '<div class="rp-sum">';
    h += '<div><p class="n" style="color:var(--critical)">' + c + '</p><p>' + esc(R.sum.critical) + '</p></div>';
    h += '<div><p class="n" style="color:var(--serious)">' + s + '</p><p>' + esc(R.sum.serious) + '</p></div>';
    h += '<div><p class="n">' + nWith + ' ' + esc(R.sum.of) + ' ' + okPages.length + '</p><p>' + esc(R.sum.pages) + '</p></div>';
    h += '<div><p class="n" style="color:var(--ok)">' + days + ' ' + esc(days === 1 ? R.sum.day : R.sum.days) + '</p><p>' + esc(R.sum.effort) + '</p></div>';
    h += '</div></div></section>';

    h += '<section class="rp-body"><div class="wrap rp-grid"><div>';
    if (issues.length) {
      h += '<div class="rp-bar"><h2>' + esc(R.found) + '</h2><div class="rp-chips" role="group" aria-label="' + esc(R.filterAria) + '">';
      h += '<button type="button" class="chip" data-f="all" aria-pressed="true">' + esc(R.all) + ' ' + tot.all + '</button>';
      if (c) h += '<button type="button" class="chip" data-f="critical" aria-pressed="false">' + esc(R.sev.critical) + ' ' + c + '</button>';
      if (s) h += '<button type="button" class="chip" data-f="serious" aria-pressed="false">' + esc(R.sev.serious) + ' ' + s + '</button>';
      if (mm) h += '<button type="button" class="chip" data-f="moderate" aria-pressed="false">' + esc(R.sev.moderate) + ' ' + mm + '</button>';
      h += '</div></div><div class="rp-list">';
      issues.forEach(function (i) {
        var rule = RULES[i.id];
        var txt = rule ? rule[L] || rule.en : [i.help, R.genericWho, R.genericFix];
        var where = (i.pages || []).map(function (p) { return R.pages[p] || p; }).join(', ');
        var sevKey = i.impact === 'minor' ? 'moderate' : i.impact;
        h += '<details class="issue" data-sev="' + sevKey + '"><summary>';
        h += '<span class="sev ' + esc(i.impact) + '">' + esc(R.sev[i.impact] || i.impact) + '</span>';
        h += '<span class="it"><strong>' + esc(txt[0]) + '</strong><span>' + esc(R.where) + ': ' + esc(where) + '</span></span>';
        h += '<span class="ic">' + i.count + '</span></summary>';
        h += '<div class="idet"><div><p class="k">' + esc(R.who) + '</p><p>' + esc(txt[1]) + '</p></div>';
        h += '<div><p class="k">' + esc(R.fix) + '</p><p>' + esc(txt[2]) + '</p></div>';
        h += '<div class="icode">';
        if (i.sample) h += '<code>' + esc(i.sample) + '</code>';
        if (rule && rule.c) h += '<code class="fixc">→ ' + esc(rule.c) + '</code>';
        h += '<span class="eff">' + esc(R.effort) + ': ' + esc(i.hrs <= 1 ? R.hoursOne : fill(R.hours, { h: i.hrs })) + '</span></div>';
        h += '</div></details>';
      });
      h += '</div><p class="muted rp-note">' + esc(R.autoNote) + '</p>';
    }
    h += '<h2 class="rp-h2">' + esc(R.method) + '</h2><p class="muted">' + esc(fill(R.methodP, { pages: pageNames })) + '</p>';
    if (failed.length) h += '<p class="muted" style="margin-top:8px">' + esc(R.notChecked) + ': ' + esc(failed.join(', ')) + '</p>';
    h += '<h2 class="rp-h2">' + esc(R.lawH) + '</h2><p class="muted">' + esc(R.law) + '</p>';
    h += '</div>';

    h += '<aside class="quote" aria-labelledby="q-h"><p class="ql">' + esc(R.quote) + '</p><h2 id="q-h">' + esc(qH) + '</h2>';
    h += '<p class="qp">' + price + '<small>' + esc(R.vat) + '</small></p><ul>';
    qList.forEach(function (x) { h += '<li>' + esc(x) + '</li>'; });
    h += '</ul><a class="btn yellow" href="' + esc(mail) + '">' + esc(R.book) + '</a><p class="qq">' + R.questions + '</p></aside>';
    h += '</div></section>';

    root.innerHTML = h;

    var chips = root.querySelectorAll('.chip');
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f');
        chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        root.querySelectorAll('.issue').forEach(function (el) { el.hidden = !(f === 'all' || el.getAttribute('data-sev') === f); });
      });
    });
  }

  var copyBtn = document.getElementById('rp-copy');
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = R.copied; setTimeout(function () { copyBtn.textContent = R.copy; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done); else done();
  });
  document.getElementById('rp-print').addEventListener('click', function () { window.print(); });
})();

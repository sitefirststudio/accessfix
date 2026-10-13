/* Access Fix landing page: free-check form + "shop the way your customers do" simulator */
(function () {
  'use strict';
  var I = JSON.parse(document.getElementById('af-i18n').textContent);

  /* ---------- free check form ---------- */
  var form = document.getElementById('check');
  var urlIn = document.getElementById('af-url');
  var emailIn = document.getElementById('af-email');
  var consent = document.getElementById('af-consent');
  var err = document.getElementById('af-err');
  var go = document.getElementById('af-go');
  var prog = document.getElementById('progress');
  var timers = [];

  function normalise(v) {
    v = (v || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      var u = new URL(v);
      if (!/\./.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
      return u.origin + '/';
    } catch (e) { return null; }
  }
  function fail(msg, field) {
    err.textContent = msg;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function setBusy(on) {
    go.disabled = on;
    go.textContent = on ? I.js.busy : go.getAttribute('data-label');
    prog.hidden = !on;
    var steps = prog.querySelectorAll('.psteps li');
    timers.forEach(clearTimeout); timers = [];
    steps.forEach(function (li) { li.className = ''; });
    if (on) {
      [0, 4000, 14000, 40000].forEach(function (ms, i) {
        timers.push(setTimeout(function () {
          for (var j = 0; j < i; j++) steps[j].className = 'done';
          steps[i].className = 'now';
        }, ms));
      });
    }
  }
  if (form) {
    go.setAttribute('data-label', go.textContent);
    [urlIn, emailIn].forEach(function (f) { f.addEventListener('input', function () { f.removeAttribute('aria-invalid'); err.textContent = ''; }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var url = normalise(urlIn.value);
      if (!url) return fail(I.js.badUrl, urlIn);
      var email = emailIn.value.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(I.js.badEmail, emailIn);
      if (email && !consent.checked) return fail(I.js.needConsent, consent);
      setBusy(true);
      prog.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      prog.focus({ preventScroll: true });
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 150000);
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url, email: email || null, consent: !!(email && consent.checked), lang: document.documentElement.lang }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        return r.json().catch(function () { return { error: 'failed' }; });
      }).then(function (d) {
        clearTimeout(to);
        if (d && d.id) { location.href = I.root + 'r/' + encodeURIComponent(d.id); return; }
        setBusy(false);
        var e2 = d && d.error;
        fail(e2 === 'rate' ? I.js.limit : e2 === 'daily' ? I.js.daily : e2 === 'unreachable' ? I.js.unreachable : e2 === 'bad_url' ? I.js.badUrl : I.js.failed + I.js.retry, e2 === 'bad_url' || e2 === 'unreachable' ? urlIn : null);
      }).catch(function () {
        clearTimeout(to);
        setBusy(false);
        fail(I.js.failed + I.js.retry);
      });
    });
  }

  /* ---------- simulator ---------- */
  var sim = document.getElementById('sim');
  if (!sim) return;
  var S = I.sim;
  var state = { mode: 'reader', ver: 'before' };
  var modeBtns = document.querySelectorAll('.mode');
  var verBtns = sim.querySelectorAll('[data-ver]');
  var verdict = document.getElementById('sim-verdict');
  var mt = document.getElementById('sim-mt'), title = document.getElementById('sim-title'), body = document.getElementById('sim-body');
  var tr = document.getElementById('sim-tr'), speak = document.getElementById('sim-speak');
  var canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  var speaking = false;

  function stopSpeech() {
    if (canSpeak) window.speechSynthesis.cancel();
    speaking = false;
    speak.textContent = S.listen;
    tr.querySelectorAll('li').forEach(function (li) { li.classList.remove('on'); });
  }
  function render() {
    var m = S.modes.filter(function (x) { return x.id === state.mode; })[0];
    var before = state.ver === 'before';
    var copy = before ? m.b : m.a;
    sim.className = 'lab v-' + state.ver + ' m-' + state.mode;
    modeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === state.mode)); });
    verBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ver') === state.ver)); });
    verdict.textContent = copy[0];
    verdict.className = 'verdict' + (before ? '' : ' good');
    mt.textContent = m.label;
    title.textContent = copy[0];
    body.textContent = copy[1];
    stopSpeech();
    tr.innerHTML = '';
    var show = state.mode === 'reader';
    tr.hidden = !show;
    speak.hidden = !show || !canSpeak;
    if (show) {
      (before ? S.tBefore : S.tAfter).forEach(function (row) {
        var li = document.createElement('li');
        li.textContent = '“' + row[0] + '”';
        if (!row[1]) li.className = 'bad';
        tr.appendChild(li);
      });
    }
  }
  modeBtns.forEach(function (b) { b.addEventListener('click', function () { state.mode = b.getAttribute('data-mode'); render(); }); });
  verBtns.forEach(function (b) { b.addEventListener('click', function () { state.ver = b.getAttribute('data-ver'); render(); }); });
  speak.addEventListener('click', function () {
    if (speaking) return stopSpeech();
    var items = tr.querySelectorAll('li');
    var lines = (state.ver === 'before' ? S.tBefore : S.tAfter);
    speaking = true; speak.textContent = S.stop;
    var i = 0;
    (function next() {
      items.forEach(function (li) { li.classList.remove('on'); });
      if (!speaking || i >= lines.length) return stopSpeech();
      items[i].classList.add('on');
      var u = new SpeechSynthesisUtterance(lines[i][0]);
      u.lang = S.speechLang; u.rate = 1.15;
      u.onend = function () { i++; next(); };
      u.onerror = function () { stopSpeech(); };
      window.speechSynthesis.speak(u);
    })();
  });
  // demo buttons inside the card do nothing except the size picker
  sim.querySelectorAll('.card button').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); }); });
  render();
})();

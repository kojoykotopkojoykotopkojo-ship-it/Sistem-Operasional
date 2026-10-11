/* PWA — Sistem Operasional Kendari
   1) Mendaftarkan service worker (hanya di https / localhost)
   2) Tombol/banner "Pasang Aplikasi" (Android, Windows, macOS Chrome/Edge, tablet) + petunjuk iOS/iPadOS
   3) Banner "Versi baru tersedia" (tidak memuat ulang otomatis, supaya isian form tidak hilang)
   Mandiri: tidak bergantung pada fungsi lain di aplikasi. Global yang dibuat: window.pasangAplikasi() */
(function () {
  'use strict';
  var LS_KEY = 'ops-kendari-pwa-dismissed';
  var SNOOZE_MS = 3 * 24 * 3600 * 1000;
  var deferred = null, bar = null, reloadOnChange = false;

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.matchMedia('(display-mode: window-controls-overlay)').matches ||
             window.matchMedia('(display-mode: minimal-ui)').matches ||
             window.matchMedia('(display-mode: fullscreen)').matches ||
             window.navigator.standalone === true;
    } catch (_) { return false; }
  }
  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function snoozed() {
    try { var t = +localStorage.getItem(LS_KEY) || 0; return t && (Date.now() - t) < SNOOZE_MS; } catch (_) { return false; }
  }
  function snooze() { try { localStorage.setItem(LS_KEY, String(Date.now())); } catch (_) {} }

  function css() {
    if (document.getElementById('pwa-style')) return;
    var s = document.createElement('style'); s.id = 'pwa-style';
    s.textContent =
      '#pwa-bar{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top) + 8px);transform:translate(-50%,-24px);' +
      'width:calc(100% - 24px);max-width:460px;z-index:10060;display:flex;align-items:center;gap:10px;padding:10px 12px;box-sizing:border-box;' +
      'background:#0B2545;color:#F6F3EA;border:1px solid #B8922F;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.5);' +
      'font:13px/1.4 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;opacity:0;transition:opacity .25s,transform .25s}' +
      '#pwa-bar.on{opacity:1;transform:translate(-50%,0)}' +
      '#pwa-bar img{width:38px;height:38px;border-radius:50%;flex:none}' +
      '#pwa-bar .t{flex:1;min-width:0}#pwa-bar .t b{display:block;font-size:13.5px;color:#D9B863}' +
      '#pwa-bar .t span{color:#dfe5ee;font-size:12px}' +
      '#pwa-bar button{border:0;border-radius:8px;padding:9px 12px;font:700 12.5px Inter,system-ui,sans-serif;cursor:pointer;flex:none;white-space:nowrap}' +
      '#pwa-bar .go{background:#B8922F;color:#26210E}' +
      '#pwa-bar .no{background:transparent;color:#9fb0c6;padding:9px 6px;font-weight:600}' +
      '@media (display-mode:standalone){#pwa-bar.ins{display:none}}';
    document.head.appendChild(s);
  }
  function hide() {
    if (!bar) return;
    var b = bar; bar = null; b.classList.remove('on');
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 300);
  }
  // kind: 'ins' (pasang) | 'upd' (pembaruan) | 'ios' | 'ok'
  function show(kind, title, text, goLabel, onGo, noLabel, onNo) {
    css(); hide();
    var d = document.createElement('div'); d.id = 'pwa-bar'; d.className = kind; d.setAttribute('role', 'dialog');
    var img = document.createElement('img'); img.src = 'icons/icon-192.png'; img.alt = '';
    var t = document.createElement('div'); t.className = 't';
    var b = document.createElement('b'); b.textContent = title;
    var s = document.createElement('span'); s.textContent = text;
    t.appendChild(b); t.appendChild(s); d.appendChild(img); d.appendChild(t);
    if (noLabel) { var n = document.createElement('button'); n.type = 'button'; n.className = 'no'; n.textContent = noLabel;
      n.onclick = function () { if (onNo) onNo(); hide(); }; d.appendChild(n); }
    if (goLabel) { var g = document.createElement('button'); g.type = 'button'; g.className = 'go'; g.textContent = goLabel;
      g.onclick = function () { onGo && onGo(); }; d.appendChild(g); }
    document.body.appendChild(d); bar = d;
    requestAnimationFrame(function () { requestAnimationFrame(function () { d.classList.add('on'); }); });
    return d;
  }

  /* ---------- Pasang aplikasi ---------- */
  function doInstall() {
    if (!deferred) { if (isIOS()) showIOS(true); return; }
    var p = deferred; deferred = null; hide();
    try {
      p.prompt();
      Promise.resolve(p.userChoice).then(function (c) { if (!c || c.outcome !== 'accepted') snooze(); }).catch(function () {});
    } catch (_) {}
  }
  function showInstall(force) {
    if (isStandalone() || !deferred || (!force && snoozed())) return;
    show('ins', 'Pasang aplikasi Ops Kendari', 'Buka langsung dari layar utama, tampil layar penuh, dan lebih cepat.',
         'Pasang', doInstall, 'Nanti', snooze);
  }
  function showIOS(force) {
    if (isStandalone() || (!force && snoozed())) return;
    show('ios', 'Pasang di iPhone / iPad',
         'Ketuk ikon Bagikan (kotak berpanah ke atas) di Safari, lalu pilih "Tambah ke Layar Utama".',
         'Mengerti', function () { snooze(); hide(); });
  }
  window.pasangAplikasi = function () {
    if (isStandalone()) return;
    if (deferred) doInstall(); else if (isIOS()) showIOS(true);
  };

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    setTimeout(function () { showInstall(false); }, 2500);   // jangan bersaing dengan animasi login
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    show('ok', 'Aplikasi terpasang ✓', 'Buka "Ops Kendari" dari layar utama / menu aplikasi Anda.');
    setTimeout(hide, 3500);
  });
  window.addEventListener('load', function () {
    if (isIOS() && !isStandalone()) setTimeout(function () { showIOS(false); }, 3000);
  });

  /* ---------- Service worker & pembaruan ---------- */
  function showUpdate(worker) {
    show('upd', 'Versi baru tersedia', 'Muat ulang untuk memakai pembaruan. Simpan dulu isian yang belum selesai.',
         'Muat ulang', function () { reloadOnChange = true; try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (_) { location.reload(); } },
         'Nanti', null);
  }
  var okProto = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && okProto) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadOnChange) { reloadOnChange = false; location.reload(); }
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
          });
        });
        var last = Date.now();
        function check() { if (Date.now() - last > 10 * 60 * 1000) { last = Date.now(); reg.update().catch(function () {}); } }
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
        setInterval(function () { last = 0; check(); }, 30 * 60 * 1000);
      }).catch(function () {});
    });
  }
})();

/* Login (Supabase Auth, email + password + captcha server-side via Edge Function login-gate) lalu ambil snapshot dashboard dari Supabase (REST / PostgREST).
   Sesi disimpan di localStorage dan diperbarui otomatis dengan refresh token. Tanpa pendaftaran publik. */
(function () {
  'use strict';
  var C = window.LSI_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var SKEY = 'lsi-dashboard-session';

  // ---------- sesi ----------
  function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function setSession(s) {
    if (!s) { localStorage.removeItem(SKEY); return; }
    localStorage.setItem(SKEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), email: (s.user && s.user.email) || s.email || '' }));
  }
  function authFetch(path, body) {
    return fetch(C.SUPABASE_URL + '/auth/v1/' + path, { method: 'POST', headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  function refresh(s) {
    return authFetch('token?grant_type=refresh_token', { refresh_token: s.refresh_token }).then(function (r) {
      if (!r.ok || !r.j.access_token) { setSession(null); return null; }
      r.j.email = s.email; setSession(r.j); return getSession();
    });
  }
  function validSession() {
    var s = getSession();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (s.expires_at - Date.now() / 1000 > 60) return Promise.resolve(s);
    return refresh(s).catch(function () { return null; });
  }

  // ---------- login UI + captcha (diverifikasi di server: Edge Function login-gate) ----------
  var GATE = C.SUPABASE_URL + '/functions/v1/login-gate';
  var cap = { token: null, pass: null, passTimer: null, busy: false, seq: 0 };
  function gate(body) {
    return fetch(GATE, { method: 'POST', headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  function capStatus(msg, cls) { var e = $('capSt'); e.textContent = msg; e.className = 'capst' + (cls ? ' cap-' + cls : ''); }
  function updateBtn() {
    var ok = !!cap.pass && !cap.busy;
    $('lgBtn').disabled = !ok; $('lgBtn').setAttribute('aria-disabled', String(!ok));
    $('capOk').hidden = !cap.pass; $('lgCap').classList.toggle('cap-ok', !!cap.pass);
  }
  function setChallenge(c) {
    clearTimeout(cap.passTimer); cap.pass = null; cap.token = c && c.token;
    var img = $('capImg'); if (c && c.img) { img.src = c.img; $('capLd').hidden = true; } else { $('capLd').hidden = false; $('capLd').textContent = 'Gagal memuat'; }
    $('lgCap').value = ''; $('lgCap').disabled = false; $('lgCap').setAttribute('aria-invalid', 'false'); updateBtn();
  }
  function newCaptcha(msg, cls) {
    var my = ++cap.seq; cap.pass = null; cap.token = null; updateBtn();
    $('capLd').hidden = false; $('capLd').textContent = 'Memuat…'; $('capRefresh').disabled = true;
    capStatus(msg || 'Ketik kode pada gambar untuk mengaktifkan tombol Masuk.', cls);
    return gate({ action: 'challenge' }).then(function (r) {
      if (my !== cap.seq) return; $('capRefresh').disabled = false;
      if (!r.ok || !r.j.token) { setChallenge(null); capStatus('Gagal memuat kode verifikasi. Tekan tombol ganti kode untuk mencoba lagi.', 'bad'); return; }
      setChallenge(r.j);
    }).catch(function () { if (my !== cap.seq) return; $('capRefresh').disabled = false; setChallenge(null); capStatus('Tidak bisa memuat kode verifikasi. Periksa koneksi internet.', 'bad'); });
  }
  function verifyCaptcha() {
    var v = $('lgCap').value.trim().toUpperCase();
    if (v.length !== 5 || !cap.token || cap.pass) return;
    var my = cap.seq; $('lgCap').disabled = true; capStatus('Memeriksa kode…');
    gate({ action: 'verify', token: cap.token, answer: v }).then(function (r) {
      if (my !== cap.seq) return;
      $('lgCap').disabled = false;
      if (r.ok && r.j.pass) {
        cap.pass = r.j.pass; cap.token = null; updateBtn();
        capStatus('Captcha benar. Silakan tekan Masuk.', 'ok');
        clearTimeout(cap.passTimer);
        cap.passTimer = setTimeout(function () { newCaptcha('Kode verifikasi kedaluwarsa. Ketik kode baru.', 'bad'); }, ((r.j.ttl || 180) - 10) * 1000);
        $('lgBtn').focus();
        return;
      }
      if (r.j.challenge) setChallenge(r.j.challenge); else { newCaptcha(); }
      var m = r.j.error === 'captcha_expired' ? 'Kode verifikasi kedaluwarsa. Ketik kode baru.' : 'Captcha salah. Ketik kode pada gambar baru.';
      capStatus(m, 'bad'); $('lgCap').setAttribute('aria-invalid', 'true'); $('lgCap').focus();
    }).catch(function () { if (my !== cap.seq) return; $('lgCap').disabled = false; capStatus('Tidak bisa memeriksa kode. Periksa koneksi internet.', 'bad'); });
  }
  $('lgCap').addEventListener('input', function () {
    var v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (this.value !== v) this.value = v;
    this.setAttribute('aria-invalid', 'false');
    if (v.length === 5) verifyCaptcha(); else if (!cap.pass) capStatus('Ketik kode pada gambar untuk mengaktifkan tombol Masuk.');
  });
  $('lgCap').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); if (cap.pass) $('loginForm').requestSubmit ? $('loginForm').requestSubmit() : $('lgBtn').click(); else verifyCaptcha(); } });
  $('capRefresh').addEventListener('click', function () { newCaptcha(); $('lgCap').focus(); });

  function errText(r) {
    var code = r && r.j && (r.j.error_code || r.j.error);
    if (code === 'invalid_credentials' || code === 'invalid_grant') return 'Email atau password salah. Periksa kembali lalu coba lagi.';
    if (code === 'captcha_required' || code === 'captcha_used' || code === 'captcha_expired' || code === 'captcha_invalid') return 'Kode verifikasi tidak valid atau kedaluwarsa. Ketik kode baru lalu coba lagi.';
    if (code === 'email_not_confirmed') return 'Akun belum dikonfirmasi. Hubungi admin dashboard.';
    if (code === 'too_many_attempts' || (r && r.status === 429)) return 'Terlalu banyak percobaan masuk. Tunggu sekitar 15 menit lalu coba lagi.';
    if (code === 'user_banned') return 'Akun ini dinonaktifkan. Hubungi admin dashboard.';
    return 'Gagal masuk' + (r && r.status ? ' (HTTP ' + r.status + ')' : '') + '. Coba lagi beberapa saat lagi.';
  }
  function showLogin(msg) {
    $('app').hidden = true; $('boot').hidden = true; $('login').hidden = false;
    document.title = 'Masuk · Dashboard Manajemen LSI';
    var e = $('lgErr'); if (msg) { e.textContent = msg; e.classList.add('on'); } else { e.textContent = ''; e.classList.remove('on'); }
    if (!cap.token && !cap.pass) newCaptcha();
    setTimeout(function () { ($('lgEmail').value ? $('lgPass') : $('lgEmail')).focus(); }, 30);
  }
  function busy(on) {
    cap.busy = on; $('lgBtn').classList.toggle('busy', on); $('lgBtnTxt').textContent = on ? 'Memproses…' : 'Masuk';
    $('lgEmail').disabled = on; $('lgPass').disabled = on; $('lgCap').disabled = on; $('capRefresh').disabled = on; updateBtn();
    if (on) $('lgBtn').disabled = true;
  }
  $('lgEye').addEventListener('click', function () {
    var p = $('lgPass'), show = p.type === 'password'; p.type = show ? 'text' : 'password';
    this.textContent = show ? 'Sembunyikan' : 'Lihat'; this.setAttribute('aria-pressed', String(show)); this.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });
  $('loginForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('lgEmail').value.trim(), pass = $('lgPass').value, e = $('lgErr');
    $('lgEmail').setAttribute('aria-invalid', 'false'); $('lgPass').setAttribute('aria-invalid', 'false');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('lgEmail').setAttribute('aria-invalid', 'true'); e.textContent = 'Masukkan alamat email yang valid.'; e.classList.add('on'); $('lgEmail').focus(); return; }
    if (!pass) { $('lgPass').setAttribute('aria-invalid', 'true'); e.textContent = 'Masukkan password.'; e.classList.add('on'); $('lgPass').focus(); return; }
    if (!cap.pass) { $('lgCap').setAttribute('aria-invalid', 'true'); e.textContent = 'Selesaikan captcha terlebih dahulu.'; e.classList.add('on'); $('lgCap').focus(); return; }
    var pk = cap.pass; cap.pass = null; clearTimeout(cap.passTimer);
    e.classList.remove('on'); busy(true);
    gate({ action: 'login', pass: pk, email: email, password: pass }).then(function (r) {
      busy(false);
      if (!r.ok || !r.j.access_token) {
        $('lgPass').value = '';
        if (r.j.error === 'invalid_credentials' || r.j.error === 'invalid_grant') $('lgPass').setAttribute('aria-invalid', 'true');
        if (r.j.challenge) { cap.seq++; setChallenge(r.j.challenge); capStatus('Ketik kode baru pada gambar untuk mencoba lagi.'); $('capRefresh').disabled = false; } else newCaptcha();
        showLogin(errText(r)); return;
      }
      setSession(r.j); $('lgPass').value = ''; $('login').hidden = true; load();
    }).catch(function () { busy(false); newCaptcha(); showLogin('Tidak bisa menghubungi server. Periksa koneksi internet lalu coba lagi.'); });
  });
  function logout() {
    var s = getSession(); setSession(null);
    if (s && s.access_token) fetch(C.SUPABASE_URL + '/auth/v1/logout', { method: 'POST', headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + s.access_token } }).catch(function () {});
    location.replace(location.pathname + location.search);   // muat ulang bersih -> halaman login
  }
  $('logoutBtn').addEventListener('click', logout);

  // ---------- dashboard ----------
  var PRE = /^\d{4}-(0[1-9]|1[0-2])$/;
  // Periode dari ?period=YYYY-MM; kalau kosong pakai DEFAULT_PERIOD ('latest' = periode terbaru di database).
  function getPeriod(list) {
    var p = new URLSearchParams(location.search).get('period');
    if (p && PRE.test(p)) return p;
    if (C.DEFAULT_PERIOD && C.DEFAULT_PERIOD !== 'latest' && PRE.test(C.DEFAULT_PERIOD)) return C.DEFAULT_PERIOD;
    return list && list.length ? list[0].period : (C.FULL_PERIOD || '2026-10');
  }
  // Daftar periode yang tersedia (tanpa kolom data, jadi ringan); gagal = daftar kosong, dashboard tetap jalan.
  function fetchPeriods(s) {
    var url = C.SUPABASE_URL + '/rest/v1/' + C.TABLE + '?select=period,label,updated_at&order=period.desc';
    return fetch(url, { headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + s.access_token, Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return Array.isArray(rows) ? rows.filter(function (x) { return x && PRE.test(x.period); }) : []; })
      .catch(function () { return []; });
  }
  // Ganti bulan dari pemilih "Bulan" di dashboard: muat ulang halaman dengan ?period= (sesi login tetap tersimpan).
  window.LSIGoPeriod = function (p) {
    if (!PRE.test(p)) return;
    var u = new URL(location.href); u.searchParams.set('period', p); location.assign(u.toString());
  };
  function periodLabel(p) { var a = p.split('-'); return BULAN[+a[1] - 1] + ' ' + a[0]; }
  function showLoading() { $('login').hidden = true; $('boot').hidden = false; $('bootLoad').hidden = false; $('bootErr').hidden = true; }
  function showError(msg, detail) {
    $('boot').hidden = false; $('bootLoad').hidden = true; $('bootErr').hidden = false;
    $('bootMsg').textContent = msg; $('bootDet').textContent = detail || ''; $('bootRetry').focus();
  }
  function fmtWIB(iso) {
    try { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) + ' WIB'; }
    catch (e) { return iso; }
  }
  var started = false;
  function render(row, period, s) {
    var label = row.label || periodLabel(period);
    document.title = 'Dashboard Manajemen LSI · ' + label;
    var badge = document.querySelector('.top .badge'); if (badge) badge.textContent = label.toUpperCase();
    if (s && s.email) { var ue = $('userEmail'); if (ue) { ue.textContent = s.email; ue.title = s.email; } }
    var src = document.querySelector('.side .src');
    if (src && row.updated_at) { var d = document.createElement('div'); d.style.cssText = 'margin-top:4px;color:#7187A8'; d.textContent = 'Snapshot Supabase: ' + fmtWIB(row.updated_at); src.appendChild(d); }
    if (row.data && row.data.sales_only) {
      var w = document.createElement('div'); w.className = 'pwarn'; w.setAttribute('role', 'note');
      w.textContent = 'Catatan: data ' + label + ' berisi penjualan (faktur & retur) yang disinkron otomatis tiap jam dari Accurate. Produksi, Neraca Finansial, dan WMS baru tersedia untuk ' + periodLabel(C.FULL_PERIOD || '2026-10') + '; Informasi Umum memakai Daftar Karyawan (data master) dari snapshot tersebut.';
      var content = document.querySelector('.content'); content.insertBefore(w, content.firstChild);
    }
    started = true;
    $('app').hidden = false;                 // tampil dulu agar grafik bisa mengukur lebar
    window.LSI_PERIOD = period;
    window.LSIApp.start(row.data);
    $('app').removeAttribute('aria-busy'); $('boot').hidden = true;
  }
  function fetchSnapshot(s, period, retried) {
    var url = C.SUPABASE_URL + '/rest/v1/' + C.TABLE + '?period=eq.' + encodeURIComponent(period) + '&select=data,label,updated_at';
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, C.TIMEOUT_MS);
    return fetch(url, { headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + s.access_token, Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined, cache: 'no-store' })
      .then(function (r) {
        clearTimeout(to);
        if (r.status === 401 && !retried) return refresh(s).then(function (ns) { if (!ns) throw { auth: true }; return fetchSnapshot(ns, period, true); });
        if (r.status === 401) throw { auth: true };
        if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 200) : '')); });
        return r.json().then(function (rows) { return { rows: rows, s: s }; });
      }, function (e) { clearTimeout(to); throw e; });
  }
  // Snapshot sales_only tidak memuat data master tanpa tanggal (Daftar Karyawan). Pinjam dari snapshot lengkap
  // (hanya kolom emp/emp_cols lewat JSON path PostgREST, jadi ringan). Gagal = modul Informasi Umum kosong saja.
  function withMaster(s, row) {
    var full = C.FULL_PERIOD || '2026-10';
    if (!row || !row.data || !row.data.sales_only || row.data.emp) return Promise.resolve(row);
    var url = C.SUPABASE_URL + '/rest/v1/' + C.TABLE + '?period=eq.' + encodeURIComponent(full) + '&select=emp:data->emp,emp_cols:data->emp_cols';
    return fetch(url, { headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + s.access_token, Accept: 'application/json' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (m) { if (Array.isArray(m) && m[0] && Array.isArray(m[0].emp)) { row.data.emp = m[0].emp; if (m[0].emp_cols) row.data.emp_cols = m[0].emp_cols; } return row; })
      .catch(function () { return row; });
  }
  function load() {
    if (started) { location.reload(); return; }
    validSession().then(function (s) {
      if (!s) { showLogin(); return; }
      showLoading();
      var period;
      return fetchPeriods(s).then(function (list) {
        window.LSI_PERIODS = list;
        period = getPeriod(list);
        return fetchSnapshot(s, period);
      }).then(function (res) {
        var rows = res.rows;
        if (Array.isArray(rows) && !rows.length) {
          return fetch(C.SUPABASE_URL + '/rest/v1/rpc/is_captcha_session', { method: 'POST', headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + res.s.access_token, 'Content-Type': 'application/json' }, body: '{}' })
            .then(function (r) { return r.ok ? r.json() : false; }).catch(function () { return true; })
            .then(function (okSess) {
              if (okSess === false) { setSession(null); showLogin('Sesi perlu diverifikasi ulang. Silakan masuk kembali dengan captcha.'); return; }
              showError('Snapshot untuk periode ' + periodLabel(period) + ' (' + period + ') belum tersedia di database.', 'Pilih periode lain, atau buka tanpa ?period untuk periode terbaru.');
            });
        }
        if (!Array.isArray(rows) || !rows.length || !rows[0].data) {
          showError('Snapshot untuk periode ' + periodLabel(period) + ' (' + period + ') belum tersedia di database.', 'Pilih periode lain, atau buka tanpa ?period untuk periode terbaru.');
          return;
        }
        return withMaster(res.s, rows[0]).then(function (row) {
          try { render(row, period, res.s); }
          catch (e) { console.error(e); showError('Data termuat, tetapi dashboard gagal ditampilkan.', String(e && e.message || e)); }
        });
      });
    }).catch(function (e) {
      if (e && e.auth) { setSession(null); showLogin('Sesi berakhir. Silakan masuk kembali.'); return; }
      var msg = e && e.name === 'AbortError' ? 'Waktu tunggu habis saat menghubungi server data.' : 'Tidak bisa mengambil data dari server. Periksa koneksi internet lalu coba lagi.';
      showError(msg, String(e && e.message || e));
    });
  }
  $('bootRetry').addEventListener('click', load);

  // PWA: shell boleh di-cache; data Supabase tidak. Banner hanya setelah ada service worker sebelumnya.
  function setNetMsg() {
    var el = $('netMsg'); if (!el) return;
    if (navigator.onLine) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = 'Anda sedang offline. Data dashboard selalu diambil dari jaringan dan baru tersedia setelah koneksi kembali.';
  }
  window.addEventListener('online', setNetMsg);
  window.addEventListener('offline', setNetMsg);
  setNetMsg();
  var swBtn = $('swReload');
  if (swBtn) swBtn.addEventListener('click', function () {
    if (!('serviceWorker' in navigator)) { location.reload(); return; }
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg && reg.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', function () { location.reload(); });
        reg.waiting.postMessage({ type: 'skipWaiting' });
        return;
      }
      location.reload();
    }).catch(function () { location.reload(); });
  });
  if ('serviceWorker' in navigator) {
    var hadSw = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var el = $('swUpdate'); if (hadSw && el) el.hidden = false;
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
    });
  }

  load();
})();

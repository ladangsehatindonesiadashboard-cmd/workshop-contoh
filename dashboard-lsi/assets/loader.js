/* Mengambil snapshot dashboard dari Supabase (REST / PostgREST), lalu merender UI. */
(function () {
  'use strict';
  var C = window.LSI_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  function getPeriod() {
    var p = new URLSearchParams(location.search).get('period');
    return p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? p : C.DEFAULT_PERIOD;
  }
  function periodLabel(p) { var a = p.split('-'); return BULAN[+a[1] - 1] + ' ' + a[0]; }

  function showLoading() { $('boot').hidden = false; $('bootLoad').hidden = false; $('bootErr').hidden = true; }
  function showError(msg, detail) {
    $('boot').hidden = false; $('bootLoad').hidden = true; $('bootErr').hidden = false;
    $('bootMsg').textContent = msg; $('bootDet').textContent = detail || '';
    $('bootRetry').focus();
  }
  function fmtWIB(iso) {
    try {
      return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) + ' WIB';
    } catch (e) { return iso; }
  }

  var started = false;
  function render(row, period) {
    var label = row.label || periodLabel(period);
    document.title = 'Dashboard Manajemen LSI · ' + label;
    var badge = document.querySelector('.top .badge'); if (badge) badge.textContent = label.toUpperCase();
    var src = document.querySelector('.side .src');
    if (src && row.updated_at) {
      var d = document.createElement('div'); d.style.cssText = 'margin-top:4px;color:#7187A8';
      d.textContent = 'Snapshot Supabase: ' + fmtWIB(row.updated_at); src.appendChild(d);
    }
    if (period !== C.UI_PERIOD) {
      var w = document.createElement('div'); w.className = 'pwarn'; w.setAttribute('role', 'note');
      w.textContent = 'Catatan: tampilan ini disusun untuk ' + periodLabel(C.UI_PERIOD) + '. Data ' + label +
        ' dimuat dari Supabase, tetapi rentang tanggal & label pada grafik masih mengikuti ' + periodLabel(C.UI_PERIOD) + '.';
      var content = document.querySelector('.content'); content.insertBefore(w, content.firstChild);
    }
    started = true;
    window.LSIApp.start(row.data);
    $('app').removeAttribute('aria-busy');
    $('boot').hidden = true;
  }

  function load() {
    if (started) { location.reload(); return; }
    var period = getPeriod();
    showLoading();
    var url = C.SUPABASE_URL + '/rest/v1/' + C.TABLE + '?period=eq.' + encodeURIComponent(period) + '&select=data,label,updated_at';
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, C.TIMEOUT_MS);
    fetch(url, {
      headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + C.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
      signal: ctl ? ctl.signal : undefined, cache: 'no-store'
    }).then(function (r) {
      clearTimeout(to);
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 200) : '')); });
      return r.json();
    }).then(function (rows) {
      if (!Array.isArray(rows) || !rows.length || !rows[0].data) {
        showError('Snapshot untuk periode ' + periodLabel(period) + ' (' + period + ') belum tersedia di database.', 'Unggah snapshot dengan scripts/upload_snapshot.py, atau buka tanpa ?period untuk ' + periodLabel(C.DEFAULT_PERIOD) + '.');
        return;
      }
      try { render(rows[0], period); }
      catch (e) { console.error(e); showError('Data termuat, tetapi dashboard gagal ditampilkan.', String(e && e.message || e)); }
    }).catch(function (e) {
      clearTimeout(to);
      var msg = e && e.name === 'AbortError' ? 'Waktu tunggu habis saat menghubungi server data.' : 'Tidak bisa mengambil data dari server. Periksa koneksi internet lalu coba lagi.';
      showError(msg, String(e && e.message || e));
    });
  }

  $('bootRetry').addEventListener('click', load);
  load();
})();

/**
 * SDLG Portal Finance + UX polish v3.0
 * Money 0.00 + calc panel; KEEP per-field Copy (user field-by-field workflow)
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V3__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V3__ = true;

  var state = { labourRate: null, mileageRate: null, otherRate: null, partPrices: {} };

  function num(v) {
    if (v == null || v === '') return null;
    var n = Number(String(v).replace(/,/g, '.').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function money(v) {
    var n = num(v);
    if (n == null) return '0.00';
    return n.toFixed(2);
  }

  function isDash(s) {
    s = String(s == null ? '' : s).trim();
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || s === '—';
  }

  function root() {
    return document.querySelector('[data-sdlg-input-helper]');
  }

  function setInput(el, value) {
    if (!el) return;
    var next = String(value);
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, next);
      else el.value = next;
    } catch (_) {
      el.value = next;
    }
    try { el.setAttribute('value', next); } catch (_) {}
  }

  function readHrsKm() {
    return {
      hrs: num((document.getElementById('sdlg_repairLabor') || {}).value),
      km: num((document.getElementById('sdlg_serviceMileage') || {}).value)
    };
  }

  function recompute() {
    var r = root();
    if (!r) return;
    var hk = readHrsKm();
    var la = document.getElementById('sdlg_labourAmount');
    if (la) {
      if (state.labourRate != null && hk.hrs != null && hk.hrs > 0) setInput(la, money(hk.hrs * state.labourRate));
      else if (isDash(la.value) || la.value === '' || la.value === '0') setInput(la, '0.00');
    }
    var ma = document.getElementById('sdlg_mileageAmount');
    if (ma) {
      if (state.mileageRate != null && hk.km != null && hk.km > 0) setInput(ma, money(hk.km * state.mileageRate));
      else if (isDash(ma.value) || ma.value === '' || ma.value === '0') setInput(ma, '0.00');
    }
    var oa = document.getElementById('sdlg_otherAmount');
    if (oa) {
      if (state.otherRate != null) setInput(oa, money(state.otherRate));
      else if (isDash(oa.value) || oa.value === '' || oa.value === '0') setInput(oa, '0.00');
    }
    var partsSum = 0;
    r.querySelectorAll('table').forEach(function (table) {
      var head = (table.querySelector('thead') && table.querySelector('thead').innerText) || '';
      if (!/Unit Price/i.test(head) || !/Failure Part/i.test(head)) return;
      table.querySelectorAll('tbody tr').forEach(function (tr, idx) {
        var cells = tr.querySelectorAll('td');
        if (cells.length < 7) return;
        var qty = num(cells[4].textContent);
        if (qty == null) qty = 1;
        var price = state.partPrices['p' + idx];
        if (price == null) {
          var existing = num(cells[5].textContent);
          price = existing != null ? existing : 0;
        }
        var amt = qty * (price || 0);
        partsSum += amt;
        cells[5].textContent = money(price);
        cells[6].textContent = money(amt);
      });
    });
    var ta = document.getElementById('sdlg_totalAmount');
    if (ta) {
      var l = num((document.getElementById('sdlg_labourAmount') || {}).value) || 0;
      var m = num((document.getElementById('sdlg_mileageAmount') || {}).value) || 0;
      var o = num((document.getElementById('sdlg_otherAmount') || {}).value) || 0;
      setInput(ta, money(partsSum + l + m + o));
    }
  }

  function ensureCalcPanel(r) {
    if (r.querySelector('[data-sdlg-finance-calc]')) return;
    var hk = readHrsKm();
    var box = document.createElement('div');
    box.setAttribute('data-sdlg-finance-calc', '1');
    box.style.cssText = 'background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px;margin:0 0 12px;font-size:11px;color:#92400e';
    box.innerHTML =
      '<div style="font-weight:800;margin-bottom:6px">Kalkulasi finansial (portal helper)</div>' +
      '<div style="margin-bottom:8px;line-height:1.45">Isi rate untuk hitung amount (copy ke portal saja; tidak menulis DB).</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Labour Rate / jam<input data-sdlg-rate="labour" type="number" step="any" placeholder="25" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Mileage Rate / km<input data-sdlg-rate="mileage" type="number" step="any" placeholder="0.5" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Unit Price part #1<input data-sdlg-rate="part0" type="number" step="any" placeholder="harga" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '</div><div style="margin-top:8px">Hrs: ' + (hk.hrs != null ? hk.hrs : '—') + ' · Km: ' + (hk.km != null ? hk.km : '—') + '</div>';
    var anchor = document.getElementById('sdlg_labourAmount');
    if (anchor) {
      var card = anchor.closest('div[style*="border-radius:14px"]') || anchor.parentElement;
      if (card && card.parentElement) card.parentElement.insertBefore(box, card);
      else r.insertBefore(box, r.firstChild);
    } else r.insertBefore(box, r.firstChild);
    box.addEventListener('input', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var kind = t.getAttribute('data-sdlg-rate');
      if (!kind) return;
      var v = num(t.value);
      if (kind === 'labour') state.labourRate = v;
      else if (kind === 'mileage') state.mileageRate = v;
      else if (kind === 'part0') state.partPrices.p0 = v == null ? 0 : v;
      recompute();
    });
  }

  function formatStaticMoney(r) {
    r.querySelectorAll('table').forEach(function (table) {
      var head = (table.querySelector('thead') && table.querySelector('thead').innerText) || '';
      if (!/Unit Price/i.test(head)) return;
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        var cells = tr.querySelectorAll('td');
        if (cells.length < 7) return;
        if (isDash(cells[5].textContent.trim()) || cells[5].textContent.trim() === '0') cells[5].textContent = '0.00';
        if (isDash(cells[6].textContent.trim()) || cells[6].textContent.trim() === '0') cells[6].textContent = '0.00';
      });
    });
    ['sdlg_labourAmount', 'sdlg_mileageAmount', 'sdlg_otherAmount', 'sdlg_totalAmount'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (isDash(el.value) || el.value === '' || el.value === '0') setInput(el, '0.00');
    });
  }

  function collapseReportName(r) {
    if (r.querySelector('[data-sdlg-report-toggle]')) return;
    var blocks = r.querySelectorAll('div');
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if ((b.textContent || '').indexOf('Nama Report') < 0) continue;
      if ((b.textContent || '').length > 900) continue;
      var mono = null;
      var kids = b.querySelectorAll('div');
      for (var k = 0; k < kids.length; k++) {
        if (/monospace/i.test(kids[k].getAttribute('style') || '')) { mono = kids[k]; break; }
      }
      if (!mono || (mono.textContent || '').length < 100) return;
      mono.style.maxHeight = '3.2em';
      mono.style.overflow = 'hidden';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-sdlg-report-toggle', '1');
      btn.textContent = 'Show more';
      btn.style.cssText = 'margin-top:6px;border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer';
      var expanded = false;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        expanded = !expanded;
        mono.style.maxHeight = expanded ? 'none' : '3.2em';
        btn.textContent = expanded ? 'Show less' : 'Show more';
      });
      if (mono.parentElement) mono.parentElement.appendChild(btn);
      return;
    }
  }

  function enhance() {
    var r = root();
    if (!r) return;
    try {
      formatStaticMoney(r);
      ensureCalcPanel(r);
      recompute();
      collapseReportName(r);
    } catch (e) {
      console.warn('[SDLG finance-ux v3]', e && e.message ? e.message : e);
    }
  }

  function boot() {
    enhance();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      var t = null;
      new MutationObserver(function () {
        clearTimeout(t);
        t = setTimeout(enhance, 400);
      }).observe(document.body, { childList: true, subtree: true });
    }
    setInterval(enhance, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/**
 * SDLG Portal Finance + UX polish v2.0
 * P0: money as 0.00 (never "—"); calc amount = qty×price / hrs×rate / km×rate
 * P0: manual rate/price inputs when source rate is null
 * P1: report name Show more/less
 * P1: hide per-field Copy; keep Copy All / Copy Nama Report
 * P2: parts_master has no price column — editable unit price for portal copy only
 */
(function () {
  'use strict';
  if (window.__SDLG_PORTAL_FINANCE_UX_V2__) return;
  window.__SDLG_PORTAL_FINANCE_UX_V2__ = true;

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
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
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

    var tables = r.querySelectorAll('table');
    var partsSum = 0;
    tables.forEach(function (table) {
      var head = (table.querySelector('thead') && table.querySelector('thead').innerText) || '';
      if (!/Unit Price/i.test(head) || !/Failure Part/i.test(head)) return;
      table.querySelectorAll('tbody tr').forEach(function (tr, idx) {
        var cells = tr.querySelectorAll('td');
        if (cells.length < 7) return;
        var qty = num(cells[4].textContent);
        if (qty == null) qty = 1;
        var key = 'p' + idx;
        var price = state.partPrices[key];
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
      '<div style="margin-bottom:8px;line-height:1.45">Source claim sering menyimpan rate/harga = 0 atau kosong. Isi rate di bawah untuk menghitung amount otomatis <b>hanya untuk copy ke Dealer Portal</b>. Tidak mengubah database kecuali Anda simpan lewat Claim Detail.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Labour Rate / jam' +
      '<input data-sdlg-rate="labour" type="number" step="any" placeholder="contoh 25" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Mileage Rate / km' +
      '<input data-sdlg-rate="mileage" type="number" step="any" placeholder="contoh 0.5" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px;font-weight:700">Unit Price part #1' +
      '<input data-sdlg-rate="part0" type="number" step="any" placeholder="harga part" style="padding:8px;border:1px solid #f59e0b;border-radius:8px;font-size:12px"></label>' +
      '</div>' +
      '<div style="margin-top:8px;color:#78350f">Hrs: ' + (hk.hrs != null ? hk.hrs : '—') + ' · Km: ' + (hk.km != null ? hk.km : '—') +
      ' · Formula: Labour = hrs×rate · Mileage = km×rate · Part = qty×unit price · Total = parts+labour+mileage+other</div>';

    var anchor = document.getElementById('sdlg_labourAmount');
    if (anchor) {
      var card = anchor.closest('div[style*="border-radius:14px"]') || anchor.parentElement;
      if (card && card.parentElement) card.parentElement.insertBefore(box, card);
      else r.insertBefore(box, r.firstChild);
    } else {
      r.insertBefore(box, r.firstChild);
    }

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
      if (!mono) continue;
      if ((mono.textContent || '').length < 100) return;
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

  function declutterCopy(r) {
    r.querySelectorAll('button[data-sdlg-copy]').forEach(function (btn) {
      if (btn.id === 'sdlg-copy-all' || btn.getAttribute('data-sdlg-copy-all') != null) return;
      if (btn.getAttribute('data-sdlg-copy-report-name') != null) return;
      if (btn.getAttribute('data-target') && !btn.getAttribute('data-value')) btn.style.display = 'none';
    });
    var allBtn = r.querySelector('#sdlg-copy-all, [data-sdlg-copy-all]');
    if (allBtn && /Copy All/i.test(allBtn.textContent || '') && (allBtn.textContent || '').indexOf('Home') < 0) {
      allBtn.textContent = 'Copy Semua Field Home';
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
      declutterCopy(r);
    } catch (e) {
      console.warn('[SDLG finance-ux v2]', e && e.message ? e.message : e);
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
    document.addEventListener('input', function (e) {
      var id = e.target && e.target.id;
      if (id === 'sdlg_repairLabor' || id === 'sdlg_serviceMileage') recompute();
    }, true);
    setInterval(enhance, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

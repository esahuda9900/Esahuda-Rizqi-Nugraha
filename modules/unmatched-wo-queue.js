(function () {
  'use strict';

  var ROOT_ID = 'sdlg-unmatched-wo-queue';
  var STYLE_ID = 'sdlg-unmatched-wo-style-v4';
  var MAX_WAIT_MS = 15000;
  var OPEN_TIMEOUT_MS = 4000;
  var opening = false;
  var qualityDesired = false;
  var observer = null;
  var mountTimer = null;
  var unmountTimer = null;
  var cachedRows = null;
  var loading = false;

  function getClient() {
    if (typeof window === 'undefined') return null;
    var candidate = window.sdlgSupabase || window.supabaseClient || window.__sdlgSupabase || null;
    if (candidate && typeof candidate.from === 'function') return candidate;
    try {
      if (typeof sdlgSupabase !== 'undefined' && sdlgSupabase && typeof sdlgSupabase.from === 'function') return sdlgSupabase;
    } catch (_) {}
    return null;
  }

  function waitForSession() {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function tick() {
        var client = getClient();
        if (client) return resolve(client);
        if (Date.now() - started > MAX_WAIT_MS) return reject(new Error('Supabase client belum siap.'));
        setTimeout(tick, 120);
      })();
    });
  }

  function ensureStyle() {
    ['sdlg-unmatched-wo-style-v1', 'sdlg-unmatched-wo-style-v2', 'sdlg-unmatched-wo-style-v3'].forEach(function (id) {
      var prev = document.getElementById(id);
      if (prev) prev.remove();
    });
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '#' + ROOT_ID + '{display:block;width:100%;max-width:1180px;margin:0 auto 20px;padding:12px 16px 8px;box-sizing:border-box;color:#152033;position:relative;z-index:2}',
      '#' + ROOT_ID + ' *{box-sizing:border-box}',
      '#' + ROOT_ID + ' .uw-shell{width:100%;min-width:0}',
      '#' + ROOT_ID + ' .uw-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}',
      '#' + ROOT_ID + ' .uw-title{font-size:18px;font-weight:800;line-height:1.25;color:#152033}',
      '#' + ROOT_ID + ' .uw-sub{margin-top:4px;font-size:12px;line-height:1.45;color:#667085}',
      '#' + ROOT_ID + ' .uw-actions{display:flex;gap:8px;flex-wrap:wrap}',
      '#' + ROOT_ID + ' button{font:inherit;min-height:34px;border:1px solid #d8e0eb;background:#fff;color:#2b3850;border-radius:10px;padding:8px 12px;cursor:pointer;font-weight:700}',
      '#' + ROOT_ID + ' .uw-primary{background:#3563e9;color:#fff;border-color:#3563e9}',
      '#' + ROOT_ID + ' .uw-open{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;padding:6px 10px;min-height:30px;font-size:11px}',
      '#' + ROOT_ID + ' .uw-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}',
      '#' + ROOT_ID + ' .uw-card{background:#fff;border:1px solid #e5eaf1;border-radius:14px;box-shadow:0 3px 14px rgba(15,23,42,.04)}',
      '#' + ROOT_ID + ' .uw-kpi{padding:14px;min-height:88px}',
      '#' + ROOT_ID + ' .uw-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7b8799;font-weight:800}',
      '#' + ROOT_ID + ' .uw-value{margin-top:8px;font-size:26px;line-height:1.1;font-weight:800;font-variant-numeric:tabular-nums}',
      '#' + ROOT_ID + ' .uw-meta{margin-top:6px;font-size:11px;color:#6b7788;line-height:1.4}',
      '#' + ROOT_ID + ' .uw-kpi.error .uw-value{color:#b42318}',
      '#' + ROOT_ID + ' .uw-kpi.insight .uw-value{color:#b54708}',
      '#' + ROOT_ID + ' .uw-panel{margin-top:12px;overflow:hidden}',
      '#' + ROOT_ID + ' .uw-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #edf1f5}',
      '#' + ROOT_ID + ' .uw-panel-title{font-size:13px;font-weight:800}',
      '#' + ROOT_ID + ' .uw-panel-meta{font-size:11px;color:#7a8798}',
      '#' + ROOT_ID + ' .uw-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '#' + ROOT_ID + ' table{width:100%;border-collapse:collapse;font-size:12px}',
      '#' + ROOT_ID + ' th{padding:8px 10px;text-align:left;background:#f8fafc;color:#718096;font-size:10px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #edf1f5;white-space:nowrap}',
      '#' + ROOT_ID + ' td{padding:10px;border-bottom:1px solid #f1f4f7;vertical-align:middle;word-break:break-word}',
      '#' + ROOT_ID + ' tr.uw-row{cursor:pointer}',
      '#' + ROOT_ID + ' tr.uw-row:hover{background:#f8fafc}',
      '#' + ROOT_ID + ' .uw-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.03em}',
      '#' + ROOT_ID + ' .uw-badge.error{background:#fef3f2;color:#b42318;border:1px solid #fecdca}',
      '#' + ROOT_ID + ' .uw-badge.insight{background:#fffaeb;color:#b54708;border:1px solid #fde68a}',
      '#' + ROOT_ID + ' .uw-claim{font-weight:800;color:#3563e9;text-decoration:underline;text-underline-offset:2px}',
      '#' + ROOT_ID + ' .uw-empty{padding:20px;text-align:center;color:#8390a2;font-size:12px}',
      '#' + ROOT_ID + ' .uw-hint{font-size:11px;color:#667085;line-height:1.4;margin-top:2px}',
      '.uw-toast{position:fixed;right:16px;bottom:16px;z-index:99999;max-width:320px;padding:12px 14px;border-radius:12px;background:#0f172a;color:#fff;font-size:12px;font-weight:600;box-shadow:0 10px 30px rgba(15,23,42,.25)}',
      '@media(min-width:761px){#' + ROOT_ID + ' .uw-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}'
    ].join('\n');
    (document.head || document.body).appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function fmt(n) {
    var x = Number(n);
    if (!isFinite(x)) return '—';
    return x.toLocaleString('id-ID');
  }

  function toast(msg) {
    var old = document.getElementById('sdlg-uw-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'sdlg-uw-toast';
    el.className = 'uw-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  }

  async function fetchQueue() {
    var sb = await waitForSession();
    var res = await sb
      .from('claim_unmatched_wo_queue_v')
      .select('claim_id,claim_wo_no,claim_status,branch,model,claim_serial_no,claim_customer,reconciliation_status,severity,action_hint,ax_serial_no,ax_wo_status')
      .in('severity', ['ERROR', 'INSIGHT'])
      .order('severity', { ascending: true })
      .order('claim_id', { ascending: true })
      .limit(500);
    if (res.error) throw res.error;
    return res.data || [];
  }

  function setReactInputValue(input, value) {
    if (!input) return;
    var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickClaimsNav() {
    var buttons = document.querySelectorAll('button.nav-btn, .nav-scroll button');
    for (var i = 0; i < buttons.length; i++) {
      var t = String(buttons[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (t.indexOf('claims') === 0 || t.indexOf('claims ·') >= 0 || t === 'klaim') {
        buttons[i].click();
        return true;
      }
    }
    return false;
  }

  function findClaimRow(claimId) {
    var id = String(claimId || '');
    var rows = document.querySelectorAll('.claim-row');
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].textContent || '').indexOf(id) !== -1) return rows[i];
    }
    return null;
  }

  function findSearchInput() {
    var page = document.querySelector('.page') || document.body;
    var candidates = page.querySelectorAll('input[type="search"], input[placeholder]');
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].closest('#' + ROOT_ID)) continue;
      var ph = String(candidates[i].getAttribute('placeholder') || '').toLowerCase();
      if (candidates[i].type === 'search' || ph.indexOf('cari') >= 0 || ph.indexOf('search') >= 0 || ph.indexOf('claim') >= 0) {
        return candidates[i];
      }
    }
    return null;
  }

  function openClaim(claimId) {
    if (!claimId || opening) return;
    var id = String(claimId).trim();
    if (!id) return;

    var external = window.SDLGOpenClaim;
    if (typeof external === 'function' && external !== openClaim && external !== window.SDLGUnmatchedWOOpenClaim) {
      try {
        external(id);
        toast('Membuka claim ' + id);
        return;
      } catch (e) {
        console.warn('[unmatched-wo] external SDLGOpenClaim failed', e);
      }
    }

    opening = true;
    qualityDesired = false; // leaving quality for claims
    stopObserver();
    try {
      try { window.sessionStorage.setItem('sdlg-pending-open-claim', id); } catch (_) {}
      window.dispatchEvent(new CustomEvent('sdlg-open-claim', { detail: { claimId: id } }));
      clickClaimsNav();

      var started = Date.now();
      (function attempt() {
        try {
          var row = findClaimRow(id);
          if (row) {
            row.click();
            toast('Claim ' + id + ' dibuka');
            opening = false;
            return;
          }
          var input = findSearchInput();
          if (input) {
            setReactInputValue(input, id);
            input.focus();
          }
          if (Date.now() - started > OPEN_TIMEOUT_MS) {
            toast('Claims dibuka — filter: ' + id);
            opening = false;
            return;
          }
          setTimeout(attempt, 200);
        } catch (err) {
          console.warn('[unmatched-wo] openClaim attempt', err);
          opening = false;
        }
      })();
    } catch (err) {
      console.warn('[unmatched-wo] openClaim', err);
      opening = false;
    }
  }

  window.SDLGUnmatchedWOOpenClaim = openClaim;

  function rowHtml(r) {
    var sev = String(r.severity || '').toLowerCase();
    var badge = '<span class="uw-badge ' + esc(sev) + '">' + esc(r.severity || '—') + '</span>';
    return (
      '<tr class="uw-row" data-claim-id="' + esc(r.claim_id) + '">' +
        '<td><span class="uw-claim">' + esc(r.claim_id) + '</span></td>' +
        '<td>' + esc(r.claim_wo_no || '—') + '</td>' +
        '<td>' + esc(r.claim_serial_no || '—') + '</td>' +
        '<td>' + esc(r.model || '—') + '</td>' +
        '<td>' + esc(r.branch || '—') + '</td>' +
        '<td>' + esc(r.claim_status || '—') + '</td>' +
        '<td>' + badge + '<div class="uw-hint">' + esc(r.action_hint || '') + '</div></td>' +
        '<td><button type="button" class="uw-open" data-open-claim="' + esc(r.claim_id) + '">Buka</button></td>' +
      '</tr>'
    );
  }

  function bindRowHandlers(root) {
    Array.prototype.forEach.call(root.querySelectorAll('tr.uw-row'), function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        openClaim(tr.getAttribute('data-claim-id'));
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('button[data-open-claim]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openClaim(btn.getAttribute('data-open-claim'));
      });
    });
  }

  function render(root, rows) {
    var errors = rows.filter(function (r) { return r.severity === 'ERROR'; });
    var insights = rows.filter(function (r) { return r.severity === 'INSIGHT'; });
    var errorRows = errors.map(rowHtml).join('');
    var insightRows = insights.map(rowHtml).join('');

    root.innerHTML =
      '<div class="uw-shell">' +
        '<div class="uw-head">' +
          '<div><div class="uw-title">Unmatched WO / Data Quality</div>' +
          '<div class="uw-sub">Claim yang WO-nya belum nyambung ke AX. Klik <b>Buka</b> untuk ke tab Claims dan edit Dealer WO / SO.</div></div>' +
          '<div class="uw-actions"><button type="button" class="uw-primary" id="uw-refresh">Refresh</button></div>' +
        '</div>' +
        '<div class="uw-kpis">' +
          '<div class="uw-card uw-kpi error"><div class="uw-label">Action Required</div><div class="uw-value">' + fmt(errors.length) + '</div><div class="uw-meta">WO tidak ketemu / belum diisi</div></div>' +
          '<div class="uw-card uw-kpi insight"><div class="uw-label">Insight</div><div class="uw-value">' + fmt(insights.length) + '</div><div class="uw-meta">Serial mismatch / WO canceled</div></div>' +
          '<div class="uw-card uw-kpi"><div class="uw-label">Total antrian</div><div class="uw-value">' + fmt(rows.length) + '</div><div class="uw-meta">Non-WAR type diabaikan</div></div>' +
        '</div>' +
        '<div class="uw-card uw-panel">' +
          '<div class="uw-panel-head"><div class="uw-panel-title">Action Required</div><div class="uw-panel-meta">' + errors.length + ' claim</div></div>' +
          '<div class="uw-table-wrap"><table><thead><tr>' +
            '<th>Claim ID</th><th>WO Claim</th><th>Serial</th><th>Model</th><th>Branch</th><th>Status</th><th>Severity</th><th></th>' +
          '</tr></thead><tbody>' +
            (errorRows || '<tr><td colspan="8" class="uw-empty">Tidak ada claim yang perlu diperbaiki.</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
        '<div class="uw-card uw-panel">' +
          '<div class="uw-panel-head"><div class="uw-panel-title">Insight (tidak memblokir)</div><div class="uw-panel-meta">' + insights.length + ' claim</div></div>' +
          '<div class="uw-table-wrap"><table><thead><tr>' +
            '<th>Claim ID</th><th>WO Claim</th><th>Serial</th><th>Model</th><th>Branch</th><th>Status</th><th>Severity</th><th></th>' +
          '</tr></thead><tbody>' +
            (insightRows || '<tr><td colspan="8" class="uw-empty">Tidak ada insight saat ini.</td></tr>') +
          '</tbody></table></div>' +
        '</div>' +
      '</div>';

    var refresh = root.querySelector('#uw-refresh');
    if (refresh) refresh.onclick = function () { forceMount(true); };
    bindRowHandlers(root);
  }

  function renderLoading(root) {
    root.innerHTML = '<div class="uw-shell"><div class="uw-head"><div><div class="uw-title">Unmatched WO / Data Quality</div><div class="uw-sub">Memuat antrian…</div></div></div></div>';
  }

  function renderError(root, err) {
    root.innerHTML =
      '<div class="uw-shell"><div class="uw-card" style="padding:16px">' +
        '<div class="uw-title">Gagal memuat Unmatched WO</div>' +
        '<div class="uw-sub">' + esc((err && err.message) || err || 'Unknown error') + '</div>' +
        '<div style="margin-top:12px"><button type="button" class="uw-primary" id="uw-retry">Coba lagi</button></div>' +
      '</div></div>';
    var btn = root.querySelector('#uw-retry');
    if (btn) btn.onclick = function () { forceMount(true); };
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (_) {
      return true;
    }
  }

  function isQualityLabel(label) {
    return /(?:data\s*)?quality/i.test(String(label || ''));
  }

  function isQualityTabActive() {
    var buttons = document.querySelectorAll('button.nav-btn, .nav-scroll button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (!isQualityLabel(btn.textContent)) continue;
      if (btn.classList.contains('active')) return true;
      if (btn.getAttribute('aria-current') === 'page') return true;
    }
    return qualityDesired;
  }

  function findPageHost() {
    var stable = document.querySelector('[data-sdlg-quality-host="1"]');
    if (stable && isVisible(stable)) return stable;

    var pages = Array.prototype.filter.call(document.querySelectorAll('.page'), isVisible);
    if (!pages.length) return null;

    // Fallback for older production HTML: detect the actual rendered
    // Data Quality page instead of relying on an arbitrary .page.
    var qualityMatch = pages.find(function (page) {
      var text = String(page.textContent || '');
      return /(?:^|\n)Data Quality(?:\s|$)/i.test(text) ||
        /DATABASE HEALTH/i.test(text) ||
        /Fokus pada issue yang benar-benar butuh tindakan/i.test(text);
    });
    return qualityMatch || null;
  }

  function scheduleUnmount() {
    if (unmountTimer) clearTimeout(unmountTimer);
    unmountTimer = setTimeout(function () {
      if (!findPageHost() && !isQualityTabActive()) unmount();
    }, 1200);
  }

  function ensureRootAttached() {
    var host = findPageHost();
    if (!host) return null;
    var root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
    }
    // Prefer the dedicated React host. It is intentionally empty in the
    // React tree, so our DOM child survives ordinary parent re-renders.
    if (root.parentNode !== host) {
      host.appendChild(root);
    }
    return root;
  }

  function unmount() {
    var root = document.getElementById(ROOT_ID);
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  async function forceMount(reloadData) {
    ensureStyle();
    var host = findPageHost();
    if (!host) {
      scheduleUnmount();
      return;
    }

    if (unmountTimer) {
      clearTimeout(unmountTimer);
      unmountTimer = null;
    }

    var root = ensureRootAttached();
    if (!root) return;

    if (cachedRows && !root.getAttribute('data-loaded')) {
      render(root, cachedRows);
      root.setAttribute('data-loaded', '1');
    }

    if ((reloadData || !root.getAttribute('data-loaded')) && !loading) {
      loading = true;
      renderLoading(root);
      try {
        var rows = await fetchQueue();
        cachedRows = rows;
        render(root, rows);
        root.setAttribute('data-loaded', '1');
      } catch (err) {
        if (cachedRows) {
          render(root, cachedRows);
          root.setAttribute('data-loaded', '1');
        } else {
          renderError(root, err);
        }
      } finally {
        loading = false;
      }
    }
  }

  function scheduleMount(reloadData) {
    if (mountTimer) clearTimeout(mountTimer);
    mountTimer = setTimeout(function () {
      forceMount(Boolean(reloadData));
    }, 120);
  }

  function startObserver() {
    if (observer) return;
    var watchRoot = document.getElementById('root') || document.body;
    if (!watchRoot || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function () {
      var host = findPageHost();
      var root = document.getElementById(ROOT_ID);
      if (!host) {
        scheduleUnmount();
        return;
      }
      if (!root || root.parentNode !== host) {
        scheduleMount(false);
      }
    });
    observer.observe(watchRoot, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function boot() {
    ensureStyle();
    window.SDLGUnmatchedWO = {
      mount: function () { qualityDesired = true; startObserver(); scheduleMount(false); },
      refresh: function () { return forceMount(true); },
      openClaim: openClaim,
      unmount: function () { qualityDesired = false; stopObserver(); if (mountTimer) clearTimeout(mountTimer); if (unmountTimer) clearTimeout(unmountTimer); unmount(); }
    };

    // Keep the feature self-healing. The React app can replace the .page node
    // several times during navigation; do not depend on one click timing.
    startObserver();
    scheduleMount(false);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('button.nav-btn, .nav-scroll button');
      if (!btn) return;
      var label = String(btn.textContent || '').toLowerCase();
      if (label.indexOf('quality') >= 0) {
        qualityDesired = true;
        startObserver();
        scheduleMount(false);
        setTimeout(function () { scheduleMount(false); }, 250);
        setTimeout(function () { scheduleMount(false); }, 700);
      } else if (btn.classList.contains('nav-btn') || (btn.closest && btn.closest('.nav-scroll'))) {
        qualityDesired = false;
        // Do not kill the observer: it is also responsible for noticing when
        // React paints the next page and for cleaning up the old host safely.
        scheduleUnmount();
      }
    }, true);

    // Restore / deep-link case.
    try {
      var saved = window.SDLGNavState && window.SDLGNavState.restore
        ? window.SDLGNavState.restore('list', null)
        : null;
      if (saved === 'quality') {
        qualityDesired = true;
        scheduleMount(false);
        setTimeout(function () { scheduleMount(false); }, 500);
        setTimeout(function () { scheduleMount(false); }, 1200);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

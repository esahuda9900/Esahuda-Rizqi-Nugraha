/**
 * SDLG Claim Detail Helper — V3.0 (Premium Detail Engine)
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE DARI FILE KOSONG (STUB) JADI PANEL FUNGSIONAL:
 * ✅ AUTO-DETECT: Ngedeteksi kalau lu buka halaman Claim Detail.
 * ✅ SMART FETCH: Narik data claim (Customer, Branch, Status) dari Supabase.
 * ✅ PREMIUM UI: Nampilin Panel "Warranty Engine" melayang di atas form.
 * ✅ ZERO CONFLICT: Gak bakal ngerusak tampilan React lu.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  if (window.__SDLG_CLAIM_DETAIL_HELPER_BOOTED__) return;
  window.__SDLG_CLAIM_DETAIL_HELPER_BOOTED__ = true;

  console.info('[SDLG] Claim Detail Premium Engine V3.0 loaded');

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES & CONFIG
  // ─────────────────────────────────────────────────────────
  function clean(v) { return v == null ? '' : String(v).trim(); }

  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') return window.getSdlgSupabase();
    return window.sdlgSupabase || window.supabaseClient || null;
  }

  // Cari ID Claim dari URL (contoh: ?claim_id=123-456-SDLG-XXX)
  function extractClaimId() {
    try {
      var q = new URLSearchParams(location.search || '');
      return q.get('claim_id') || q.get('claimId') || q.get('id') || '';
    } catch (_) { return ''; }
  }

  // ─────────────────────────────────────────────────────────
  // 2. STYLES (Premium Glassmorphism)
  // ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('sdlg-detail-engine-styles')) return;
    var style = document.createElement('style');
    style.id = 'sdlg-detail-engine-styles';
    style.textContent = [
      '.sdlg-engine-panel {',
      '  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);',
      '  border: 1px solid #e2e8f0; border-radius: 16px;',
      '  padding: 20px 24px; margin-bottom: 24px;',
      '  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);',
      '  font-family: system-ui, -apple-system, sans-serif;',
      '  display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: space-between;',
      '  animation: sdlgFadeIn 0.4s ease-out;',
      '}',
      '@keyframes sdlgFadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }',
      '.sdlg-engine-info { display: flex; flex-direction: column; gap: 4px; }',
      '.sdlg-engine-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }',
      '.sdlg-engine-value { font-size: 15px; font-weight: 600; color: #0f172a; }',
      '.sdlg-engine-badges { display: flex; gap: 8px; flex-wrap: wrap; }',
      '.sdlg-badge { padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }',
      '.sdlg-badge--success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }',
      '.sdlg-badge--warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }',
      '.sdlg-badge--error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }',
      '.sdlg-badge--info { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  // 3. RENDER PANEL (Tampilan)
  // ─────────────────────────────────────────────────────────
  function renderEnginePanel(container, claim) {
    if (document.getElementById('sdlg-warranty-engine-panel')) return;
    injectStyles();

    var status = clean(claim.claim_status || 'Draft');
    var badgeClass = 'sdlg-badge--info';
    if (/Approved|Paid/i.test(status)) badgeClass = 'sdlg-badge--success';
    else if (/Rejected/i.test(status)) badgeClass = 'sdlg-badge--error';
    else if (/On Hold|Pending/i.test(status)) badgeClass = 'sdlg-badge--warning';

    var panel = document.createElement('div');
    panel.id = 'sdlg-warranty-engine-panel';
    panel.className = 'sdlg-engine-panel';

    panel.innerHTML = `
      <div style="display:flex; gap:32px; flex-wrap:wrap;">
        <div class="sdlg-engine-info">
          <div class="sdlg-engine-label">Claim ID</div>
          <div class="sdlg-engine-value" style="font-family:monospace;">${clean(claim.claim_id)}</div>
        </div>
        <div class="sdlg-engine-info">
          <div class="sdlg-engine-label">Customer</div>
          <div class="sdlg-engine-value">${clean(claim.customer || claim.customer_name || '—')}</div>
        </div>
        <div class="sdlg-engine-info">
          <div class="sdlg-engine-label">Branch</div>
          <div class="sdlg-engine-value">${clean(claim.branch || claim.branch_name || '—')}</div>
        </div>
        <div class="sdlg-engine-info">
          <div class="sdlg-engine-label">Serial No</div>
          <div class="sdlg-engine-value" style="font-family:monospace;">${clean(claim.serial_no || '—')}</div>
        </div>
      </div>
      <div>
        <div class="sdlg-engine-badges">
          <div class="sdlg-badge ${badgeClass}">
            ● ${status}
          </div>
          ${claim.days_open ? `<div class="sdlg-badge sdlg-badge--info">⏱ ${claim.days_open} hari</div>` : ''}
        </div>
      </div>
    `;

    // Selipin panel ke paling atas halaman detail
    container.insertBefore(panel, container.firstChild);
  }

  // ─────────────────────────────────────────────────────────
  // 4. MAIN ORCHESTRATOR
  // ─────────────────────────────────────────────────────────
  async function runDetailEngine() {
    var detailRoot = document.querySelector('.page.claim-detail-page[data-sdlg-claim-detail="1"]') 
                  || document.querySelector('[data-sdlg-claim-detail="1"]') 
                  || document.querySelector('.page.claim-detail-page');
    
    if (!detailRoot) return; // Bukan halaman detail, skip.

    var claimId = extractClaimId();
    if (!claimId || claimId === 'undefined') return;

    var client = getClient();
    if (!client) {
      console.warn('[SDLG Engine] Supabase client belum siap.');
      return;
    }

    try {
      // Tarik data dari tabel claims
      var res = await client.from('claims').select('*').eq('claim_id', claimId).maybeSingle();
      if (res.error) throw res.error;
      
      if (res.data) {
        renderEnginePanel(detailRoot, res.data);
      }
    } catch (err) {
      console.warn('[SDLG Engine] Gagal fetch data claim:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. OBSERVER (Nunggu halaman di-render React)
  // ─────────────────────────────────────────────────────────
  var checkCount = 0;
  var maxChecks = 20; // 20 x 500ms = 10 detik

  var interval = setInterval(function () {
    if (++checkCount > maxChecks) { clearInterval(interval); return; }
    
    var root = document.querySelector('.page.claim-detail-page') || document.querySelector('[data-sdlg-claim-detail="1"]');
    if (root) {
      clearInterval(interval);
      runDetailEngine();
    }
  }, 500);

  // Re-run kalau URL berubah (SPA behavior)
  window.addEventListener('popstate', runDetailEngine);

})();
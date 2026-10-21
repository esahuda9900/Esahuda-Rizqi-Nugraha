/**
 * SDLG Warranty — Payment Evidence UI (Enterprise Finance V2.0)
 * Read-only finance-control presentation. No claim writes or status mutation.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ AUTO DARK MODE: Ngikutin tema sistem.
 * ✅ SKELETON LOADING: Animasi shimmer pas fetch data.
 * ✅ PREMIUM UI: Status badges, hover effects, tabular-nums.
 * ✅ SMART OBSERVER: Cuma ngawasin area .page (bukan seluruh DOM).
 * ✅ SAFE FETCH: Error handling terintegrasi SDLGNotify.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (window.__SDLG_PAYMENT_EVIDENCE_V2__) return;
  window.__SDLG_PAYMENT_EVIDENCE_V2__ = true;

  const STYLE_ID = 'sdlg-payment-evidence-style-v2';
  const PANEL_ID = 'sdlg-payment-evidence-panel';
  const STACK_ID = 'sdlg-finance-evidence-stack';

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ─────────────────────────────────────────────────────────
  const money = (v, currency) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + (currency || 'CNY');
  };
  
  const date = (v) => v ? String(v).slice(0, 10) : '—';
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function getClient() {
    if (typeof root.getSdlgSupabase === 'function') return root.getSdlgSupabase();
    return root.sdlgSupabase || null;
  }

  // ─────────────────────────────────────────────────────────
  // 2. STYLES (Dark Mode Ready)
  // ─────────────────────────────────────────────────────────
  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        --pe-bg: #ffffff;
        --pe-bg-subtle: #f8fafc;
        --pe-border: #e2e8f0;
        --pe-text: #0f172a;
        --pe-text-muted: #64748b;
        --pe-accent: #2f5bff;
        --pe-success: #16a34a;
        --pe-warning: #d97706;
        
        margin: 18px 0; padding: 24px;
        border: 1px solid var(--pe-border); border-radius: 16px;
        background: var(--pe-bg); box-shadow: 0 4px 20px -5px rgba(0,0,0,0.05);
        font-family: system-ui, -apple-system, sans-serif; color: var(--pe-text);
        animation: peFadeIn 0.4s ease-out;
      }
      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} {
          --pe-bg: #111a2e; --pe-bg-subtle: #1e293b; --pe-border: #1e2a45;
          --pe-text: #f8fafc; --pe-text-muted: #94a3b8; --pe-accent: #4d70ff;
          box-shadow: 0 4px 20px -5px rgba(0,0,0,0.3);
        }
      }
      @keyframes peFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      #${PANEL_ID} .pe-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
      #${PANEL_ID} .pe-title { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
      #${PANEL_ID} .pe-sub { font-size: 12px; color: var(--pe-text-muted); margin-top: 6px; line-height: 1.5; max-width: 760px; }
      #${PANEL_ID} .pe-meta { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: var(--pe-accent); background: rgba(47,91,255,0.1); padding: 6px 10px; border-radius: 999px; white-space: nowrap; }

      #${PANEL_ID} .pe-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
      #${PANEL_ID} .pe-stat { padding: 14px 16px; border: 1px solid var(--pe-border); border-radius: 12px; background: var(--pe-bg-subtle); transition: transform 0.2s; }
      #${PANEL_ID} .pe-stat:hover { transform: translateY(-2px); }
      #${PANEL_ID} .pe-k { font-size: 11px; color: var(--pe-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
      #${PANEL_ID} .pe-v { font-size: 20px; font-weight: 800; margin-top: 6px; font-variant-numeric: tabular-nums; }
      #${PANEL_ID} .pe-v.muted { font-size: 14px; color: var(--pe-text-muted); }

      #${PANEL_ID} .pe-row { padding: 16px 0; border-top: 1px solid var(--pe-border); transition: background 0.15s; border-radius: 8px; }
      #${PANEL_ID} .pe-row:hover { background: var(--pe-bg-subtle); }
      #${PANEL_ID} .pe-main { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; padding: 0 8px; }
      #${PANEL_ID} .pe-batch { font-size: 15px; font-weight: 800; }
      #${PANEL_ID} .pe-count { font-size: 12px; color: var(--pe-text-muted); margin-top: 4px; }
      
      #${PANEL_ID} .pe-status { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; padding: 6px 10px; border-radius: 999px; text-transform: uppercase; }
      #${PANEL_ID} .pe-status.received { background: rgba(22,163,74,0.15); color: #166534; }
      #${PANEL_ID} .pe-status.pending { background: rgba(217,119,6,0.15); color: #92400e; }
      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} .pe-status.received { color: #86efac; }
        #${PANEL_ID} .pe-status.pending { color: #fde047; }
      }

      #${PANEL_ID} .pe-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-top: 16px; padding: 0 8px; }
      #${PANEL_ID} .pe-cell { min-width: 0; }
      #${PANEL_ID} .pe-v.small { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${PANEL_ID} .pe-note { margin-top: 16px; padding: 12px 16px; border-radius: 10px; background: var(--pe-bg-subtle); color: var(--pe-text-muted); font-size: 12px; line-height: 1.6; border: 1px solid var(--pe-border); }
      #${PANEL_ID} .pe-note strong { color: var(--pe-text); }
      
      /* Skeleton */
      .pe-skel { background: var(--pe-bg-subtle); border-radius: 8px; animation: pePulse 1.5s infinite; }
      @keyframes pePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

      @media (max-width: 1100px) { #${PANEL_ID} .pe-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 760px) {
        #${PANEL_ID} { padding: 16px; }
        #${PANEL_ID} .pe-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        #${PANEL_ID} .pe-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  // 3. DATA FETCHING
  // ─────────────────────────────────────────────────────────
  async function load(client) {
    if (!client || typeof client.from !== 'function') return [];
    try {
      const result = await client.from('sdlg_payment_batch_summary_v').select('*').order('finance_received_date', { ascending: false });
      if (result.error) throw result.error;
      return Array.isArray(result.data) ? result.data : [];
    } catch (err) {
      console.warn('[SDLG Payment] Fetch error:', err.message);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. DOM RENDERERS
  // ─────────────────────────────────────────────────────────
  function renderSkeleton() {
    return `
      <div class="pe-head">
        <div><div class="pe-skel" style="width:200px;height:24px;margin-bottom:8px"></div><div class="pe-skel" style="width:100%;max-width:500px;height:16px"></div></div>
      </div>
      <div class="pe-summary">${[1,2,3,4].map(()=>`<div class="pe-skel" style="height:80px"></div>`).join('')}</div>
      <div class="pe-skel" style="width:100%;height:120px;margin-top:16px"></div>
    `;
  }

  function build(rows) {
    if (!rows || !rows.length) {
      return `
        <div class="pe-head"><div><div class="pe-title">SDLG Payment Evidence</div><div class="pe-sub">Belum ada data batch pembayaran.</div></div></div>
        <div class="pe-note">Data akan muncul di sini setelah finance melakukan input batch.</div>
      `;
    }

    const received = rows.filter(r => String(r.payment_status || '').toUpperCase() === 'RECEIVED').length;
    const totalClaims = rows.reduce((a, r) => a + (num(r.claim_count) || 0), 0);
    const totalAgreement = rows.reduce((a, r) => a + (num(r.agreement_amount_cny) || 0), 0);

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="pe-head">
        <div>
          <div class="pe-title">SDLG Payment Evidence</div>
          <div class="pe-sub">Finance evidence ditampilkan di level batch. Batch yang <em>received</em> mengonfirmasi bukti pembayaran untuk batch tersebut, namun <strong>tidak</strong> mengindikasikan alokasi bank ke tiap claim.</div>
        </div>
        <div class="pe-meta">FINANCE CONTROL</div>
      </div>
      
      <div class="pe-summary">
        <div class="pe-stat"><div class="pe-k">Total Batches</div><div class="pe-v">${rows.length}</div></div>
        <div class="pe-stat"><div class="pe-k">Received</div><div class="pe-v">${received}</div></div>
        <div class="pe-stat"><div class="pe-k">Claims in Batches</div><div class="pe-v">${totalClaims.toLocaleString('en-US')}</div></div>
        <div class="pe-stat"><div class="pe-k">Agreement Total</div><div class="pe-v">${money(totalAgreement, 'CNY')}</div></div>
      </div>
      
      ${rows.slice(0, 5).map(function (r) {
        const delta = num(r.calculated_vs_agreement_delta_cny);
        const batchCode = r.batch_code || '—';
        const statusText = String(r.payment_status || '—').toUpperCase();
        const statusCls = statusText === 'RECEIVED' ? 'received' : 'pending';

        return `<div class="pe-row">
          <div class="pe-main">
            <div>
              <div class="pe-batch">${escapeHtml(r.batch_name || batchCode)}</div>
              <div class="pe-count">${escapeHtml(batchCode)} · ${escapeHtml((r.settlement_count || 0) + ' ORF / ' + (r.claim_count || 0) + ' claims')}</div>
            </div>
            <div class="pe-status ${statusCls}">${statusText}</div>
          </div>
          <div class="pe-grid">
            <div class="pe-cell"><div class="pe-k">Agreement</div><div class="pe-v small">${escapeHtml(money(r.agreement_amount_cny, r.currency))}</div></div>
            <div class="pe-cell"><div class="pe-k">Calculated</div><div class="pe-v small">${escapeHtml(money(r.member_calculated_amount_cny, r.currency))}</div></div>
            <div class="pe-cell"><div class="pe-k">Delta</div><div class="pe-v small">${escapeHtml(delta == null ? '—' : delta.toFixed(3) + ' CNY')}</div></div>
            <div class="pe-cell"><div class="pe-k">SDLG Done</div><div class="pe-v small">${escapeHtml(date(r.sdlg_payment_completed_date))}</div></div>
            <div class="pe-cell"><div class="pe-k">ITR Received</div><div class="pe-v small">${escapeHtml(date(r.finance_received_date))}</div></div>
            <div class="pe-cell"><div class="pe-k">Debit Note</div><div class="pe-v small">${escapeHtml(r.debit_note_no || '—')}</div></div>
          </div>
        </div>`;
      }).join('')}
      
      <div class="pe-note">
        <strong>Rebalancing Rule:</strong> Calculated settlement, approved amount, dan actual received payment adalah 3 hal yang terpisah. UI tidak akan memfabrikasi alokasi pembayaran per-claim jika hanya tersedia bukti di level batch.
      </div>
    `;
    return panel;
  }

  // ─────────────────────────────────────────────────────────
  // 5. MOUNT LOGIC & OBSERVER
  // ─────────────────────────────────────────────────────────
  function getEvidenceStack() {
    let stack = document.getElementById(STACK_ID);
    if (stack) return stack;
    const page = document.querySelector('.page');
    if (!page) return null;
    
    stack = document.createElement('div');
    stack.id = STACK_ID;
    stack.style.cssText = 'display:block;width:100%;min-width:0;margin:0;padding:0;';
    
    const anchor = document.getElementById('sdlg-command-center-v2') || page.querySelector('.wx-analytics-shell') || page.querySelector('.wx-panel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(stack, anchor);
    else page.insertBefore(stack, page.firstElementChild || null);
    
    return stack;
  }

  function isMasterDashboard() {
    if (!document.body) return false;
    const activeNav = document.querySelector('.nav-btn.active');
    if (activeNav) return /master dashboard/i.test(String(activeNav.textContent || ''));
    const page = document.querySelector('.page');
    return Boolean(page && page.querySelector('.metric-grid'));
  }

  let mounting = false;
  async function mount() {
    if (!isMasterDashboard()) return;
    
    const existing = document.getElementById(PANEL_ID);
    if (existing && existing.getAttribute('data-loaded') === '1') return; // Udah ada isinya
    if (mounting) return;

    const client = getClient();
    if (!client) return; // Supabase belum siap

    mounting = true;
    addStyle();

    // Tampilkan Skeleton dulu
    const stack = getEvidenceStack();
    if (!stack) { mounting = false; return; }

    let skeleton = document.getElementById(PANEL_ID);
    if (!skeleton) {
      skeleton = document.createElement('section');
      skeleton.id = PANEL_ID;
      skeleton.innerHTML = renderSkeleton();
      stack.appendChild(skeleton);
    }

    try {
      const rows = await load(client);
      const panel = build(rows);
      panel.setAttribute('data-loaded', '1');
      
      // Ganti skeleton dengan data asli
      if (skeleton.parentNode) skeleton.parentNode.replaceChild(panel, skeleton);
      else stack.appendChild(panel);
      
    } catch (err) {
      if (window.SDLGNotify) window.SDLGNotify.error('Payment Evidence', 'Gagal memuat data batch pembayaran.');
      if (skeleton.parentNode) skeleton.remove();
    } finally {
      mounting = false;
    }
  }

  let queued = false;
  function queueMount() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; mount(); }, 350);
  }

  // ─────────────────────────────────────────────────────────
  // 6. INIT & OBSERVER
  // ─────────────────────────────────────────────────────────
  root.SDLGPaymentEvidence = { mount: mount, queueMount: queueMount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', queueMount);
  } else {
    queueMount();
  }

  // Observer pintar: Cuma ngawasin .page kalau belum ada panelnya
  if (typeof MutationObserver !== 'undefined' && document.body) {
    const obs = new MutationObserver(function () {
      if (document.getElementById(PANEL_ID)) {
        // Kalau panel udah ada, matiin observer biar gak berat
        obs.disconnect();
        return;
      }
      if (isMasterDashboard()) queueMount();
    });
    
    // Scope ke .page aja, bukan documentElement
    const pageContainer = document.querySelector('.page') || document.body;
    obs.observe(pageContainer, { childList: true, subtree: true });
  }

})(window);
/**
 * SDLG Warranty — Rebalancing Evidence UI — V2.0 (Enterprise Edition)
 * Read-only finance control. No claim writes.
 * 
 * ═══════════════════════════════════════════════════════════
 * UPGRADE V2.0:
 * ✅ BUG FIX: escapeHtml sekarang bener (Anti-XSS).
 * ✅ SKELETON LOADING: Animasi shimmer pas narik data.
 * ✅ AUTO DARK MODE: Ngikutin tema sistem.
 * ✅ PREMIUM UI: Hover effects, tabular-nums.
 * ✅ SMART OBSERVER: Cuma ngawasin .page, mati otomatis.
 * ═══════════════════════════════════════════════════════════
 */
(function (root) {
  'use strict';

  if (window.__SDLG_REBALANCING_EVIDENCE_V2__) return;
  window.__SDLG_REBALANCING_EVIDENCE_V2__ = true;

  const STYLE_ID = 'sdlg-rebalancing-evidence-style-v2';
  const PANEL_ID = 'sdlg-rebalancing-evidence-panel';
  const STACK_ID = 'sdlg-finance-evidence-stack';

  // ─────────────────────────────────────────────────────────
  // 1. UTILITIES
  // ─────────────────────────────────────────────────────────
  const money = (v, currency) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + (currency || 'CNY');
  };
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
  const int = (v) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0;

  // FIX BUG: Escape HTML yang benar biar gak error/XSS
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
        --re-bg: #ffffff;
        --re-bg-subtle: #f8fafc;
        --re-border: #e2e8f0;
        --re-text: #0f172a;
        --re-text-muted: #64748b;
        --re-accent: #2f5bff;
        
        margin: 18px 0; padding: 24px;
        border: 1px solid var(--re-border); border-radius: 16px;
        background: var(--re-bg); box-shadow: 0 4px 20px -5px rgba(0,0,0,0.05);
        font-family: system-ui, -apple-system, sans-serif; color: var(--re-text);
        animation: reFadeIn 0.4s ease-out;
      }
      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} {
          --re-bg: #111a2e; --re-bg-subtle: #1e293b; --re-border: #1e2a45;
          --re-text: #f8fafc; --re-text-muted: #94a3b8; --re-accent: #4d70ff;
          box-shadow: 0 4px 20px -5px rgba(0,0,0,0.3);
        }
      }
      @keyframes reFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      #${PANEL_ID} .sre-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
      #${PANEL_ID} .sre-title { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
      #${PANEL_ID} .sre-sub { font-size: 12px; color: var(--re-text-muted); margin-top: 6px; line-height: 1.5; max-width: 820px; }
      #${PANEL_ID} .sre-meta { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: var(--re-accent); background: rgba(47,91,255,0.1); padding: 6px 10px; border-radius: 999px; white-space: nowrap; }

      #${PANEL_ID} .sre-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
      #${PANEL_ID} .sre-stat { padding: 14px 16px; border: 1px solid var(--re-border); border-radius: 12px; background: var(--re-bg-subtle); transition: transform 0.2s; }
      #${PANEL_ID} .sre-stat:hover { transform: translateY(-2px); }
      #${PANEL_ID} .sre-k { font-size: 11px; color: var(--re-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
      #${PANEL_ID} .sre-v { font-size: 20px; font-weight: 800; margin-top: 6px; font-variant-numeric: tabular-nums; }
      #${PANEL_ID} .sre-v.small { font-size: 14px; font-weight: 700; }

      #${PANEL_ID} .sre-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
      #${PANEL_ID} .sre-card { padding: 16px; border: 1px solid var(--re-border); border-radius: 12px; background: var(--re-bg); }
      #${PANEL_ID} .sre-card h4 { margin: 0 0 12px; font-size: 12px; font-weight: 800; color: var(--re-text); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--re-border); padding-bottom: 8px; }
      
      #${PANEL_ID} .sre-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; font-size: 13px; border-bottom: 1px solid var(--re-bg-subtle); }
      #${PANEL_ID} .sre-row:last-child { border-bottom: none; }
      #${PANEL_ID} .sre-row span { color: var(--re-text-muted); }
      #${PANEL_ID} .sre-row b { color: var(--re-text); font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

      #${PANEL_ID} .sre-card-wide { grid-column: span 2; }
      #${PANEL_ID} .sre-note { margin-top: 20px; padding: 12px 16px; border-radius: 10px; background: var(--re-bg-subtle); color: var(--re-text-muted); font-size: 12px; line-height: 1.6; border: 1px solid var(--re-border); }
      #${PANEL_ID} .sre-note strong { color: var(--re-text); }

      /* Skeleton */
      .sre-skel { background: var(--re-bg-subtle); border-radius: 8px; animation: rePulse 1.5s infinite; }
      @keyframes rePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

      @media (max-width: 1100px) {
        #${PANEL_ID} .sre-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        #${PANEL_ID} .sre-grid { grid-template-columns: 1fr; }
        #${PANEL_ID} .sre-card-wide { grid-column: span 1; }
      }
      @media (max-width: 760px) { #${PANEL_ID} { padding: 16px; } }
    `;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  // 3. DATA FETCHING
  // ─────────────────────────────────────────────────────────
  async function load(client) {
    if (!client || typeof client.from !== 'function') return { summary: null, disputes: [], batch: null };
    try {
      const [sumRes, disRes, batchRes] = await Promise.all([
        client.from('claim_rebalancing_summary_v').select('*').limit(1),
        client.from('sdlg_settlement_disputes').select('*').order('tsi'),
        client.from('sdlg_payment_batch_summary_v').select('*').order('finance_received_date', { ascending: false }).limit(1)
      ]);
      return {
        summary: Array.isArray(sumRes?.data) && sumRes.data[0] ? sumRes.data[0] : null,
        disputes: Array.isArray(disRes?.data) ? disRes.data : [],
        batch: Array.isArray(batchRes?.data) && batchRes.data[0] ? batchRes.data[0] : null
      };
    } catch (err) {
      console.warn('[SDLG Rebalancing] Fetch error:', err.message);
      return { summary: null, disputes: [], batch: null };
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. DOM RENDERERS
  // ─────────────────────────────────────────────────────────
  function renderSkeleton() {
    return `
      <div class="sre-head"><div><div class="sre-skel" style="width:250px;height:24px;margin-bottom:8px"></div><div class="sre-skel" style="width:100%;max-width:600px;height:16px"></div></div></div>
      <div class="sre-summary">${[1,2,3,4].map(()=>`<div class="sre-skel" style="height:80px"></div>`).join('')}</div>
      <div class="sre-grid">${[1,2,3].map(()=>`<div class="sre-skel" style="height:160px"></div>`).join('')}</div>
    `;
  }

  function build(data) {
    const s = data.summary;
    if (!s) return null;

    const variance = num(s.sdlg_paid_minus_matched_fob_cny);
    const batch = data.batch || {};
    const disputes = data.disputes || [];
    const approvedLabel = int(s.approved_captured_paid) > 0
      ? (int(s.approved_captured_paid).toLocaleString('en-US') + ' paid')
      : '—';

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="sre-head">
        <div>
          <div class="sre-title">Claim Rebalancing Evidence</div>
          <div class="sre-sub">
            Membandingkan <strong>FOB / claim amount</strong>, <strong>SDLG approved + paid</strong> (nilai ORF),
            dan <strong>bukti batch + debit note</strong>. COGS company dari WO belum diimport.
            313 claim di batch RECEIVED dianggap <strong>lunas</strong> dengan share = nilai settlement.
          </div>
        </div>
        <div class="sre-meta">REBALANCING</div>
      </div>
      
      <div class="sre-summary">
        <div class="sre-stat"><div class="sre-k">Claims</div><div class="sre-v">${int(s.claim_rows).toLocaleString('en-US')}</div></div>
        <div class="sre-stat"><div class="sre-k">Paid batch complete</div><div class="sre-v">${int(s.paid_batch_complete).toLocaleString('en-US')}</div></div>
        <div class="sre-stat"><div class="sre-k">Still open / unmatched</div><div class="sre-v">${int(s.missing_settlement).toLocaleString('en-US')}</div></div>
        <div class="sre-stat"><div class="sre-k">Approved+paid captured</div><div class="sre-v small">${escapeHtml(approvedLabel)}</div></div>
      </div>
      
      <div class="sre-grid">
        <div class="sre-card">
          <h4>1. Claim FOB amount</h4>
          <div class="sre-row"><span>All CNY claims</span><b>${escapeHtml(money(s.claim_fob_all_cny))}</b></div>
          <div class="sre-row"><span>Matched (paid batch)</span><b>${escapeHtml(money(s.claim_fob_matched_cny))}</b></div>
          <div class="sre-row"><span>Unmatched CNY</span><b>${escapeHtml(money(s.claim_fob_unmatched_cny))}</b></div>
          <div class="sre-row"><span>All USD claims</span><b>${escapeHtml(money(s.claim_fob_all_usd, 'USD'))}</b></div>
          <div class="sre-row"><span>Basis</span><b>claims.total_amount (FOB)</b></div>
        </div>
        
        <div class="sre-card">
          <h4>2. SDLG approved + paid</h4>
          <div class="sre-row"><span>Paid total (313 ORF)</span><b>${escapeHtml(money(s.sdlg_approved_paid_cny))}</b></div>
          <div class="sre-row"><span>Recorded on claims</span><b>${escapeHtml(money(s.claim_payment_recorded_cny))}</b></div>
          <div class="sre-row"><span>vs matched FOB</span><b>${escapeHtml(variance == null ? '—' : money(variance))}</b></div>
          <div class="sre-row"><span>Meaning</span><b>Approved and paid by SDLG</b></div>
        </div>
        
        <div class="sre-card">
          <h4>3. Batch bank evidence</h4>
          <div class="sre-row"><span>Agreement received</span><b>${escapeHtml(money(s.batch_received_agreement_cny))}</b></div>
          <div class="sre-row"><span>Batch status</span><b>${escapeHtml(batch.payment_status || '—')}</b></div>
          <div class="sre-row"><span>Debit note</span><b>${escapeHtml(batch.debit_note_no || '—')}</b></div>
          <div class="sre-row"><span>Batch code</span><b>${escapeHtml(batch.batch_code || '—')}</b></div>
          <div class="sre-row"><span>Per-claim share</span><b>Settlement ORF amount</b></div>
        </div>
      </div>
      
      <div class="sre-grid">
        <div class="sre-card">
          <h4>Evidence status</h4>
          <div class="sre-row"><span>Paid batch complete</span><b>${int(s.paid_batch_complete)}</b></div>
          <div class="sre-row"><span>Missing settlement</span><b>${int(s.missing_settlement)}</b></div>
          <div class="sre-row"><span>Paid share recorded</span><b>${int(s.paid_share_recorded)}</b></div>
          <div class="sre-row"><span>No payment evidence</span><b>${int(s.no_payment_evidence)}</b></div>
          <div class="sre-row"><span>Dispute under negotiation</span><b>${int(s.disputed_under_negotiation)}</b></div>
        </div>
        
        <div class="sre-card sre-card-wide">
          <h4>Disputed ORFs (excluded — under negotiation)</h4>
          ${disputes.length ? disputes.map(function (d) {
            const label = (d.tsi || '') + (d.claim_id ? ' · ' + d.claim_id : '') + ' · ' + (d.status || '');
            return `<div class="sre-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(money(d.disputed_amount_cny))}</b></div>`;
          }).join('') : '<div class="sre-row"><span>None registered</span><b>—</b></div>'}
          <div class="sre-row"><span>Dispute total</span><b>${escapeHtml(money(s.dispute_amount_cny))} · ${int(s.dispute_orf_count)} ORF</b></div>
        </div>
      </div>
      
      <div class="sre-note">
        <strong>Rules:</strong> For the September paid batch, settlement ORF amount = SDLG approved + paid share per claim;
        sum matches debit note <strong>FTI 260000069</strong> / agreement CNY 2,399,579.93.
        Claim FOB is not company COGS. Disputed claims stay On Hold until negotiation ends.
      </div>
    `;
    return panel;
  }

  // ─────────────────────────────────────────────────────────
  // 5. MOUNT LOGIC
  // ─────────────────────────────────────────────────────────
  function isMasterDashboard() {
    if (!document.body) return false;
    const activeNav = document.querySelector('.nav-btn.active');
    if (activeNav) return /master dashboard/i.test(String(activeNav.textContent || ''));
    const page = document.querySelector('.page');
    return Boolean(page && page.querySelector('.metric-grid'));
  }

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

  let mounting = false;
  async function mount() {
    if (!isMasterDashboard()) return;
    const existing = document.getElementById(PANEL_ID);
    if (existing && existing.getAttribute('data-loaded') === '1') return;
    if (mounting) return;

    const client = getClient();
    if (!client) return;

    mounting = true;
    addStyle();

    const stack = getEvidenceStack();
    if (!stack) { mounting = false; return; }

    // 1. Tampilkan Skeleton
    let skeleton = document.getElementById(PANEL_ID);
    if (!skeleton) {
      skeleton = document.createElement('section');
      skeleton.id = PANEL_ID;
      skeleton.innerHTML = renderSkeleton();
      stack.appendChild(skeleton);
    }

    try {
      // 2. Fetch Data
      const data = await load(client);
      const panel = build(data);
      
      if (panel) {
        panel.setAttribute('data-loaded', '1');
        if (skeleton.parentNode) skeleton.parentNode.replaceChild(panel, skeleton);
        else stack.appendChild(panel);
      } else {
        if (skeleton.parentNode) skeleton.remove();
      }
    } catch (err) {
      if (window.SDLGNotify) window.SDLGNotify.error('Rebalancing Evidence', 'Gagal memuat data.');
      if (skeleton.parentNode) skeleton.remove();
    } finally {
      mounting = false;
    }
  }

  let queued = false;
  function queueMount() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; mount(); }, 400);
  }

  // ─────────────────────────────────────────────────────────
  // 6. INIT & OBSERVER
  // ─────────────────────────────────────────────────────────
  root.SDLGRebalancingEvidence = { mount: mount, queueMount: queueMount };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', queueMount);
  } else {
    queueMount();
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    const obs = new MutationObserver(function () {
      if (document.getElementById(PANEL_ID)) {
        obs.disconnect(); // Matiin observer kalau panel udah ada
        return;
      }
      if (isMasterDashboard()) queueMount();
    });
    
    const pageContainer = document.querySelector('.page') || document.body;
    obs.observe(pageContainer, { childList: true, subtree: true });
  }

})(window);
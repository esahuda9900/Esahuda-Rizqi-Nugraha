/**
 * SDLG Warranty — Payment Evidence UI
 * Read-only finance-control presentation. No claim writes or status mutation.
 */
(function (root) {
  'use strict';

  const STYLE_ID = 'sdlg-payment-evidence-style';
  const PANEL_ID = 'sdlg-payment-evidence-panel';

  const money = (v, currency) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + (currency || 'CNY');
  };
  const date = (v) => v ? String(v).slice(0, 10) : '—';
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:18px 0;padding:20px;border:1px solid rgba(22,35,61,.10);border-radius:14px;background:#fff;box-shadow:0 4px 18px rgba(22,35,61,.05);font-family:inherit;color:#16233d}
      #${PANEL_ID} .spe-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:16px}
      #${PANEL_ID} .spe-title{font-size:17px;font-weight:750;letter-spacing:-.01em}
      #${PANEL_ID} .spe-sub{font-size:12px;color:#667085;margin-top:5px;line-height:1.5;max-width:760px}
      #${PANEL_ID} .spe-meta{font-size:10px;font-weight:750;letter-spacing:.08em;color:#667085;white-space:nowrap;padding:6px 9px;border:1px solid rgba(22,35,61,.10);border-radius:999px}
      #${PANEL_ID} .spe-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
      #${PANEL_ID} .spe-stat{padding:12px 13px;border:1px solid rgba(22,35,61,.08);border-radius:10px;background:#fafbfc}
      #${PANEL_ID} .spe-k{font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:.045em}
      #${PANEL_ID} .spe-v{font-size:15px;font-weight:700;margin-top:4px}
      #${PANEL_ID} .spe-v.muted{font-size:13px;color:#667085;font-weight:600}
      #${PANEL_ID} .spe-row{padding:15px 0;border-top:1px solid rgba(22,35,61,.08)}
      #${PANEL_ID} .spe-main{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
      #${PANEL_ID} .spe-batch{font-size:14px;font-weight:700}
      #${PANEL_ID} .spe-count{font-size:12px;color:#667085;margin-top:4px}
      #${PANEL_ID} .spe-status{font-size:10px;font-weight:750;letter-spacing:.04em;padding:5px 8px;border-radius:999px;background:#eef8f4;color:#0c8b63;white-space:nowrap}
      #${PANEL_ID} .spe-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:13px}
      #${PANEL_ID} .spe-cell{min-width:0}
      #${PANEL_ID} .spe-v.small{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #${PANEL_ID} .spe-note{margin-top:12px;padding:9px 11px;border-radius:9px;background:#f7f8fa;color:#667085;font-size:11px;line-height:1.5}
      #${PANEL_ID} .spe-note strong{color:#344054}
      #${PANEL_ID} .spe-empty{padding:22px 4px;color:#667085;font-size:13px}
      @media (max-width:1100px){#${PANEL_ID} .spe-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media (max-width:760px){#${PANEL_ID}{padding:16px}#${PANEL_ID} .spe-summary{grid-template-columns:repeat(2,minmax(0,1fr))}#${PANEL_ID} .spe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#${PANEL_ID} .spe-head{gap:10px}}
    `;
    document.head.appendChild(style);
  }

  function isMasterDashboard() {
    if (!document.body) return false;
    const activeNav = document.querySelector('.nav-btn.active');
    if (activeNav) return /master dashboard/i.test(String(activeNav.textContent || ''));
    const pageTitle = document.querySelector('.page .page-title');
    if (pageTitle) return /master dashboard|warranty command center/i.test(String(pageTitle.textContent || ''));
    const page = document.querySelector('.page');
    return Boolean(page && page.querySelector('.metric-grid'));
  }

  async function load(client) {
    if (!client || typeof client.from !== 'function') return [];
    try {
      const result = await client.from('sdlg_payment_batch_summary_v').select('*').order('finance_received_date', { ascending: false });
      return Array.isArray(result && result.data) ? result.data : [];
    } catch (_) { return []; }
  }

  function statusTone(status) {
    return String(status || '').toUpperCase() === 'RECEIVED' ? 'spe-status' : 'spe-status';
  }

  function build(rows) {
    if (!rows.length) return null;

    const received = rows.filter(r => String(r.payment_status || '').toUpperCase() === 'RECEIVED').length;
    const totalClaims = rows.reduce((a, r) => a + (num(r.claim_count) || 0), 0);
    const totalAgreement = rows.reduce((a, r) => a + (num(r.agreement_amount_cny) || 0), 0);

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="spe-head">
        <div>
          <div class="spe-title">SDLG Payment Evidence</div>
          <div class="spe-sub">Finance evidence is shown at batch level. A received batch confirms payment evidence for the batch, but does <strong>not</strong> imply a bank allocation to each claim.</div>
        </div>
        <div class="spe-meta">FINANCE CONTROL</div>
      </div>
      <div class="spe-summary">
        <div class="spe-stat"><div class="spe-k">Batches</div><div class="spe-v">${rows.length}</div></div>
        <div class="spe-stat"><div class="spe-k">Received</div><div class="spe-v">${received}</div></div>
        <div class="spe-stat"><div class="spe-k">Claims in batches</div><div class="spe-v">${totalClaims.toLocaleString('en-US')}</div></div>
        <div class="spe-stat"><div class="spe-k">Agreement total</div><div class="spe-v">${money(totalAgreement, 'CNY')}</div></div>
      </div>
      ${rows.slice(0, 5).map(function (r) {
        const delta = num(r.calculated_vs_agreement_delta_cny);
        const batchCode = r.batch_code || '—';
        return `<div class="spe-row">
          <div class="spe-main">
            <div><div class="spe-batch">${escapeHtml(r.batch_name || batchCode)}</div><div class="spe-count">${escapeHtml(batchCode)} · ${escapeHtml((r.settlement_count || 0) + ' ORF / ' + (r.claim_count || 0) + ' claims')}</div></div>
            <div class="${statusTone(r.payment_status)}">${escapeHtml(r.payment_status || '—')}</div>
          </div>
          <div class="spe-grid">
            <div class="spe-cell"><div class="spe-k">Agreement</div><div class="spe-v small">${escapeHtml(money(r.agreement_amount_cny, r.currency))}</div></div>
            <div class="spe-cell"><div class="spe-k">Calculated</div><div class="spe-v small">${escapeHtml(money(r.member_calculated_amount_cny, r.currency))}</div></div>
            <div class="spe-cell"><div class="spe-k">Delta</div><div class="spe-v small">${escapeHtml(delta == null ? '—' : delta.toFixed(3) + ' CNY')}</div></div>
            <div class="spe-cell"><div class="spe-k">SDLG done</div><div class="spe-v small">${escapeHtml(date(r.sdlg_payment_completed_date))}</div></div>
            <div class="spe-cell"><div class="spe-k">ITR received</div><div class="spe-v small">${escapeHtml(date(r.finance_received_date))}</div></div>
            <div class="spe-cell"><div class="spe-k">Debit Note</div><div class="spe-v small">${escapeHtml(r.debit_note_no || '—')}</div></div>
          </div>
        </div>`;
      }).join('')}
      <div class="spe-note"><strong>Rebalancing rule:</strong> calculated settlement, approved amount, and actual received payment remain separate evidence fields. The UI will not fabricate per-claim payment allocation when only batch-level evidence exists.</div>
    `;
    return panel;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function getEvidenceStack() {
    let stack = document.getElementById('sdlg-finance-evidence-stack');
    if (stack) return stack;
    const page = document.querySelector('.page');
    if (!page) return null;
    stack = document.createElement('div');
    stack.id = 'sdlg-finance-evidence-stack';
    stack.style.cssText = 'display:block;width:100%;min-width:0;margin:0;padding:0;';
    if (!document.getElementById('sdlg-finance-evidence-stack-style')) {
      const style = document.createElement('style');
      style.id = 'sdlg-finance-evidence-stack-style';
      style.textContent = '#sdlg-finance-evidence-stack > section{margin-bottom:18px}';
      document.head.appendChild(style);
    }
    const anchor = document.getElementById('sdlg-command-center-v2') || page.querySelector('.wx-analytics-shell') || page.querySelector('.wx-panel');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(stack, anchor);
    else page.insertBefore(stack, page.firstElementChild || null);
    return stack;
  }

  let mounting = false;
  async function mount() {
    if (!isMasterDashboard()) return;
    if (document.getElementById(PANEL_ID)) return;
    if (mounting) return;
    const client = (typeof root.sdlgSupabase !== 'undefined') ? root.sdlgSupabase : null;
    if (!client) return;
    mounting = true;
    try {
      addStyle();
      const rows = await load(client);
      if (document.getElementById(PANEL_ID)) return;
      const panel = build(rows);
      if (!panel) return;
      const stack = getEvidenceStack();
      if (stack) {
        const existingRebal = document.getElementById('sdlg-rebalancing-evidence-panel');
        if (existingRebal && existingRebal.parentNode === stack) stack.insertBefore(panel, existingRebal);
        else stack.appendChild(panel);
      }
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

  root.SDLGPaymentEvidence = { mount: mount, queueMount: queueMount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueMount);
  else queueMount();
  new MutationObserver(function () {
    if (document.getElementById(PANEL_ID)) return;
    if (isMasterDashboard()) queueMount();
  }).observe(document.documentElement, { childList: true, subtree: true });
})(window);

/**
 * SDLG Warranty — Rebalancing Evidence UI
 * Read-only finance control. No claim writes.
 * Layers: claim FOB | SDLG approved+paid (settlement) | batch bank evidence | disputes.
 * Company COGS from WO is not imported yet.
 */
(function (root) {
  'use strict';

  const STYLE_ID = 'sdlg-rebalancing-evidence-style';
  const PANEL_ID = 'sdlg-rebalancing-evidence-panel';

  const money = (v, currency) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
      + ' ' + (currency || 'CNY');
  };
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
  const int = (v) => Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:18px 0;padding:20px;border:1px solid rgba(22,35,61,.10);border-radius:14px;background:#fff;box-shadow:0 4px 18px rgba(22,35,61,.05);font-family:inherit;color:#16233d}
      #${PANEL_ID} .sre-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:16px}
      #${PANEL_ID} .sre-title{font-size:17px;font-weight:750;letter-spacing:-.01em}
      #${PANEL_ID} .sre-sub{font-size:12px;color:#667085;margin-top:5px;line-height:1.5;max-width:820px}
      #${PANEL_ID} .sre-meta{font-size:10px;font-weight:750;letter-spacing:.08em;color:#667085;white-space:nowrap;padding:6px 9px;border:1px solid rgba(22,35,61,.10);border-radius:999px}
      #${PANEL_ID} .sre-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
      #${PANEL_ID} .sre-stat{padding:12px 13px;border:1px solid rgba(22,35,61,.08);border-radius:10px;background:#fafbfc}
      #${PANEL_ID} .sre-k{font-size:10px;color:#667085;text-transform:uppercase;letter-spacing:.045em}
      #${PANEL_ID} .sre-v{font-size:15px;font-weight:700;margin-top:4px}
      #${PANEL_ID} .sre-v.small{font-size:13px}
      #${PANEL_ID} .sre-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:4px}
      #${PANEL_ID} .sre-card{padding:14px 14px;border:1px solid rgba(22,35,61,.08);border-radius:10px;background:#fff}
      #${PANEL_ID} .sre-card h4{margin:0 0 8px;font-size:12px;font-weight:700;color:#344054;text-transform:uppercase;letter-spacing:.04em}
      #${PANEL_ID} .sre-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:12px;border-bottom:1px solid rgba(22,35,61,.06)}
      #${PANEL_ID} .sre-row:last-child{border-bottom:0}
      #${PANEL_ID} .sre-row span{color:#667085}
      #${PANEL_ID} .sre-row b{color:#16233d;font-weight:650;text-align:right}
      #${PANEL_ID} .sre-note{margin-top:14px;padding:9px 11px;border-radius:9px;background:#f7f8fa;color:#667085;font-size:11px;line-height:1.5}
      #${PANEL_ID} .sre-note strong{color:#344054}
      @media (max-width:1100px){#${PANEL_ID} .sre-summary{grid-template-columns:repeat(2,minmax(0,1fr))}#${PANEL_ID} .sre-grid{grid-template-columns:1fr}}
      @media (max-width:760px){#${PANEL_ID}{padding:16px}}
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
    if (!client || typeof client.from !== 'function') return { summary: null, disputes: [], batch: null };
    try {
      const [sumRes, disRes, batchRes] = await Promise.all([
        client.from('claim_rebalancing_summary_v').select('*').limit(1),
        client.from('sdlg_settlement_disputes').select('*').order('tsi'),
        client.from('sdlg_payment_batch_summary_v').select('*').order('finance_received_date', { ascending: false }).limit(1)
      ]);
      return {
        summary: Array.isArray(sumRes && sumRes.data) && sumRes.data[0] ? sumRes.data[0] : null,
        disputes: Array.isArray(disRes && disRes.data) ? disRes.data : [],
        batch: Array.isArray(batchRes && batchRes.data) && batchRes.data[0] ? batchRes.data[0] : null
      };
    } catch (_) {
      return { summary: null, disputes: [], batch: null };
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&').replaceAll('<', '<').replaceAll('>', '>')
      .replaceAll('"', '"').replaceAll("'", '&#039;');
  }

  function build(data) {
    const s = data.summary;
    if (!s) return null;

    const variance = num(s.sdlg_paid_minus_matched_fob_cny);
    const batch = data.batch || {};
    const disputes = data.disputes || [];
    const approvedLabel = int(s.approved_captured_paid) > 0
      ? (int(s.approved_captured_paid) + ' paid')
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
          <div class="sre-row"><span>Basis</span><b>claims.total_amount (FOB, not COGS)</b></div>
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
      <div class="sre-grid" style="margin-top:10px">
        <div class="sre-card">
          <h4>Evidence status</h4>
          <div class="sre-row"><span>Paid batch complete</span><b>${int(s.paid_batch_complete)}</b></div>
          <div class="sre-row"><span>Missing settlement</span><b>${int(s.missing_settlement)}</b></div>
          <div class="sre-row"><span>Paid share recorded</span><b>${int(s.paid_share_recorded)}</b></div>
          <div class="sre-row"><span>No payment evidence</span><b>${int(s.no_payment_evidence)}</b></div>
          <div class="sre-row"><span>Dispute under negotiation</span><b>${int(s.disputed_under_negotiation)}</b></div>
        </div>
        <div class="sre-card" style="grid-column: span 2">
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
      const data = await load(client);
      if (document.getElementById(PANEL_ID)) return;
      const panel = build(data);
      if (!panel) return;
      const stack = getEvidenceStack();
      if (stack) {
        const paymentPanel = document.getElementById('sdlg-payment-evidence-panel');
        if (paymentPanel && paymentPanel.parentNode === stack) {
          stack.appendChild(panel);
        } else {
          stack.appendChild(panel);
        }
      }
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

  root.SDLGRebalancingEvidence = { mount: mount, queueMount: queueMount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueMount);
  else queueMount();
  new MutationObserver(function () {
    if (document.getElementById(PANEL_ID)) return;
    if (isMasterDashboard()) queueMount();
  }).observe(document.documentElement, { childList: true, subtree: true });
})(window);

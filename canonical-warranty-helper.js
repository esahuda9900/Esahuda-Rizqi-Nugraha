(function () {
  'use strict';

  // Canonical portal helper v1.2.8
  // Portal Home field writes DISABLED when __SDLG_DISABLE_CANONICAL_PORTAL_WRITES__ or hydrate present.
  // Still used for Warranty Assessment panels on claim detail pages.

  var DEFAULT_CLAIM_SELECT = [
    'claim_id','model','serial_no','customer','repair_method','technical_personnel',
    'causing_part_no','causing_part_desc','failure_part_location','fault_description',
    'cause_analyze','comment','parts','hm_failure','hm_completion','sales_date',
    'failure_date','dealer_repair_date','completion_date','dealer_claim_date',
    'labour_amount','mileage_amount','other_amount','total_amount','mileage_km'
  ].join(',');

  function claimSelect() {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.CLAIM_SELECT) {
        return window.SDLG_CLAIM_FIELDS.CLAIM_SELECT;
      }
    } catch (_) {}
    return DEFAULT_CLAIM_SELECT;
  }

  var scheduled = false;
  var lastAppliedKey = '';
  var applying = false;
  var RE = /^\d{3,4}-\d{4}-SDLG-PFR$/i;

  function clean(v) { return v == null ? '' : String(v).trim(); }
  function displayStatus(v) { return clean(v).replace(/_/g, ' '); }

  function formatPortalDate(v) {
    var s = clean(v);
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '/' + m[2] + '/' + m[1];
    return s;
  }

  function findClaimId() {
    try {
      var h = String(location.hash || '');
      var hm = h.match(/(?:sdlg-input|sdlginput|claims|claim)\/(\d{3,4}-\d{4}-SDLG-PFR)/i);
      if (hm) return clean(hm[1]);
    } catch (_) {}
    try {
      if (window.SDLGInputClaimLock && window.SDLGInputClaimLock.activeClaimId) {
        var locked = window.SDLGInputClaimLock.activeClaimId();
        if (locked) return clean(locked);
      }
    } catch (_) {}
    try {
      if (window.__SDLG_LIVE_CLAIM__ && window.__SDLG_LIVE_CLAIM__.claim_id) {
        var lid = clean(window.__SDLG_LIVE_CLAIM__.claim_id);
        if (RE.test(lid)) return lid;
      }
    } catch (_) {}
    return '';
  }

  function getClient() {
    if (typeof window.getSdlgSupabase === 'function') {
      var c = window.getSdlgSupabase();
      if (c) return c;
    }
    return window.sdlgSupabase || window.supabaseClient || null;
  }

  function isPortalInputPage() {
    try {
      if (document.querySelector('[data-sdlg-input-helper]')) return true;
      if (/sdlg-input|sdlginput/i.test(String(location.hash || ''))) return true;
      if (window.__SDLG_DISABLE_CANONICAL_PORTAL_WRITES__) return true;
      if (window.SDLGInputHydrate) return true;
    } catch (_) {}
    return false;
  }

  async function loadClaim(claimId) {
    var c = getClient();
    if (!c) throw new Error('No Supabase client');
    var res = await c.from('claims').select(claimSelect()).eq('claim_id', claimId).maybeSingle();
    if (res.error) throw res.error;
    return res.data;
  }

  async function run() {
    if (scheduled || applying) return;
    // On SDLG Input Helper page: hydrate owns all portal fields — do nothing
    if (isPortalInputPage()) return;
    scheduled = true;
    try {
      var claimId = findClaimId();
      if (!claimId) return;
      if (lastAppliedKey === claimId) return;
      applying = true;
      var claim = await loadClaim(claimId);
      if (!claim) return;
      if (findClaimId() !== claimId) return;
      // Claim-detail warranty assessment only — no portal home field writes here anymore
      lastAppliedKey = claimId;
      try {
        console.info('[SDLG Helper] claim-detail context', claim.claim_id, '(portal writes delegated to hydrate)');
      } catch (_) {}
    } catch (err) {
      console.warn('[SDLG Helper]', err && err.message ? err.message : err);
    } finally {
      applying = false;
      scheduled = false;
    }
  }

  function schedule() {
    if (scheduled || applying) return;
    if (isPortalInputPage()) return;
    setTimeout(run, 250);
  }

  window.addEventListener('hashchange', function () { lastAppliedKey = ''; schedule(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  setTimeout(schedule, 800);
})();

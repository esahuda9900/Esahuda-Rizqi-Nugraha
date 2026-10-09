/**
 * Runtime fix: Feedback Person + Feedback Contact.
 * v1.2 — getSdlgSupabase, broader claim-id match, fill by id + label, never Kosong/xxx.
 */
(function () {
  'use strict';
  if (window.__SDLG_FB_PERSON_FIX_V12__) return;
  window.__SDLG_FB_PERSON_FIX_V12__ = true;

  function clean(v) { return v == null ? '' : String(v).trim(); }

  function isEmptyish(v) {
    var s = clean(v);
    return !s || s === '\u2014' || s === '-' || s === '\u2013' || /^xxx+$/i.test(s) || /^kosong$/i.test(s) || /^unknown$/i.test(s);
  }

  function stripTech(n) {
    return clean(n).replace(/^technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
  }

  function personFrom(claim) {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.PORTAL_HOME && window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackPerson) {
        var r = window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackPerson.fromClaim(claim);
        if (r) return r;
      }
    } catch (_) {}
    return stripTech(claim && (claim.technical_personnel || claim.feedback_person || claim.technician_name || claim.technician));
  }

  function contactFrom(claim) {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.PORTAL_HOME && window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackContact) {
        var r = window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackContact.fromClaim(claim);
        if (r) return r;
      }
    } catch (_) {}
    return clean(claim && (claim.feedback_contact || claim.feedback_phone || claim.phone || claim.customer_phone || claim.mobile));
  }

  function findClaimId() {
    try {
      var q = new URLSearchParams(location.search || '');
      var id = q.get('claim_id') || q.get('claimId') || q.get('id');
      if (id) return clean(id);
    } catch (_) {}
    var t = document.body ? document.body.innerText : '';
    var m = t.match(/\b\d{3,4}-\d{4}-SDLG-[A-Z0-9]+\b/i);
    return m ? m[0] : '';
  }

  function findClient() {
    if (typeof window.getSdlgSupabase === 'function') {
      try {
        var c = window.getSdlgSupabase();
        if (c && typeof c.from === 'function') return c;
      } catch (_) {}
    }
    var names = ['sdlgSupabase', 'supabaseClient', 'sb', 'db', 'SDLGSupabase'];
    for (var i = 0; i < names.length; i++) {
      var x = window[names[i]];
      if (x && typeof x.from === 'function') return x;
    }
    return null;
  }

  function setInput(el, value) {
    if (!el) return;
    var next = value == null ? '' : String(value);
    try {
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, next);
      else el.value = next;
    } catch (_) {
      el.value = next;
    }
    if (typeof el.setAttribute === 'function') el.setAttribute('value', next);
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function fillField(id, labels, value) {
    var out = isEmptyish(value) ? '\u2014' : String(value);
    var byId = document.getElementById(id);
    if (byId && (byId.tagName === 'INPUT' || byId.tagName === 'TEXTAREA')) {
      if (isEmptyish(byId.value) || byId.value !== out) setInput(byId, out);
      return;
    }
    var nodes = document.querySelectorAll('input, textarea');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var near = el.closest ? el.closest('div, section, form, label') : null;
      var nearText = near ? (near.innerText || '') : '';
      var hit = false;
      for (var j = 0; j < labels.length; j++) {
        if (nearText.indexOf(labels[j]) >= 0) { hit = true; break; }
      }
      if (!hit) continue;
      if (isEmptyish(el.value) || el.value !== out) setInput(el, out);
      return;
    }
  }

  var lastKey = '';
  var busy = false;

  async function run() {
    if (busy) return;
    var claimId = findClaimId();
    if (!claimId) return;
    var bodyText = document.body ? document.body.innerText : '';
    if (bodyText.indexOf('Feedback Person') < 0 && bodyText.indexOf('Warranty Claim Input Helper') < 0) return;

    busy = true;
    try {
      var client = findClient();
      if (!client) return;
      var res = await client.from('claims').select('claim_id,technical_personnel').eq('claim_id', claimId).maybeSingle();
      if (res.error || !res.data) return;
      var person = personFrom(res.data);
      var contact = contactFrom(res.data);
      fillField('sdlg_feedbackPerson', ['Feedback Person'], person);
      fillField('sdlg_feedbackContact', ['Feedback Contact Information', 'Feedback Contact'], contact);
      lastKey = claimId + '|' + person + '|' + contact;
    } catch (e) {
      console.warn('[SDLG FB fix]', e && e.message ? e.message : e);
    } finally {
      busy = false;
    }
  }

  function schedule() { setTimeout(run, 250); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  setInterval(run, 2000);
})();

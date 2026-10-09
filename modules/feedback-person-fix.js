/**
 * Runtime fix: Feedback Person + Feedback Contact.
 * v1.3 — resolve claim id from SELECTED select value / header, NEVER first option in dropdown list.
 * Wrong-id regression: body.innerText includes all <option> texts → matched other claim (e.g. Unknown) → wiped Panji with —.
 */
(function () {
  'use strict';
  if (window.__SDLG_FB_PERSON_FIX_V13__) return;
  window.__SDLG_FB_PERSON_FIX_V13__ = true;

  var CLAIM_RE = /\b(\d{3,4}-\d{4}-SDLG-[A-Z0-9]+)\b/i;
  var CLAIM_HEADER_RE = /\b(\d{3,4}-\d{4}-SDLG-[A-Z0-9]+)\s*[·•|]\s*\S+/i;

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
        if (r && !isEmptyish(r)) return r;
      }
    } catch (_) {}
    var raw = claim && (claim.technical_personnel || claim.feedback_person || claim.technician_name || claim.technician);
    var n = stripTech(raw);
    if (!n || isEmptyish(n)) return '';
    return n;
  }

  function contactFrom(claim) {
    try {
      if (window.SDLG_CLAIM_FIELDS && window.SDLG_CLAIM_FIELDS.PORTAL_HOME && window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackContact) {
        var r = window.SDLG_CLAIM_FIELDS.PORTAL_HOME.feedbackContact.fromClaim(claim);
        if (r && !isEmptyish(r)) return r;
      }
    } catch (_) {}
    return clean(claim && (claim.feedback_contact || claim.feedback_phone || claim.phone || claim.customer_phone || claim.mobile));
  }

  function findClaimId() {
    // 1) URL
    try {
      var q = new URLSearchParams(location.search || '');
      var id = clean(q.get('claim_id') || q.get('claimId') || q.get('id') || '');
      if (id && CLAIM_RE.test(id)) return id.match(CLAIM_RE)[1];
    } catch (_) {}

    // 2) SELECTED value of any claim <select> (NOT option list / NOT body.innerText)
    try {
      var selects = document.querySelectorAll('select');
      for (var i = 0; i < selects.length; i++) {
        var v = clean(selects[i].value);
        if (v && CLAIM_RE.test(v)) return v.match(CLAIM_RE)[1];
        var opt = selects[i].options && selects[i].options[selects[i].selectedIndex];
        if (opt) {
          var ot = clean(opt.value || opt.textContent || '');
          var om = ot.match(CLAIM_RE);
          if (om) return om[1];
        }
      }
    } catch (_) {}

    // 3) Header inside helper page only: "0250-2026-SDLG-PFR · L936H · ..."
    try {
      var root = document.querySelector('[data-sdlg-input-helper]') || document.body;
      if (root) {
        var nodes = root.querySelectorAll('div, span, h1, h2, h3, p, strong, b');
        for (var j = 0; j < nodes.length; j++) {
          var t = clean(nodes[j].childNodes.length === 1 ? nodes[j].textContent : '');
          if (!t || t.length > 120) continue;
          var hm = t.match(CLAIM_HEADER_RE);
          if (hm) return hm[1];
        }
        var scoped = clean(root.innerText || '').split('\n');
        for (var k = 0; k < scoped.length; k++) {
          var line = clean(scoped[k]);
          if (!line || line.length > 160) continue;
          var lm = line.match(CLAIM_HEADER_RE);
          if (lm) return lm[1];
        }
      }
    } catch (_) {}

    return '';
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

  function fillField(id, labels, value, forceDash) {
    var out;
    if (value && !isEmptyish(value)) out = String(value);
    else if (forceDash) out = '\u2014';
    else return; // do not wipe a good value with empty

    var byId = document.getElementById(id);
    if (byId && (byId.tagName === 'INPUT' || byId.tagName === 'TEXTAREA')) {
      if (byId.value !== out) setInput(byId, out);
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
      if (el.value !== out) setInput(el, out);
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
      if (res.error) {
        console.warn('[SDLG FB fix] query error', claimId, res.error);
        return;
      }
      if (!res.data) {
        console.warn('[SDLG FB fix] no row', claimId);
        return;
      }
      var person = personFrom(res.data);
      var contact = contactFrom(res.data);
      // Always write person when we have a real name; dash only after confirmed empty for THIS claim
      fillField('sdlg_feedbackPerson', ['Feedback Person'], person, true);
      fillField('sdlg_feedbackContact', ['Feedback Contact Information', 'Feedback Contact'], contact, true);
      lastKey = claimId + '|' + person + '|' + contact;
      try {
        console.info('[SDLG FB fix] filled', claimId, 'person=', person || '(none)', 'contact=', contact || '(none)');
      } catch (_) {}
    } catch (e) {
      console.warn('[SDLG FB fix]', e && e.message ? e.message : e);
    } finally {
      busy = false;
    }
  }

  function schedule() { setTimeout(run, 300); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  if (typeof MutationObserver !== 'undefined') {
    var t = null;
    var obs = new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(run, 400);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('change', function (e) {
    if (e && e.target && e.target.tagName === 'SELECT') {
      lastKey = '';
      schedule();
    }
  }, true);
  setInterval(run, 3000);
})();

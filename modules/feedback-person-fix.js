/**
 * Feedback Person / Contact prefill — v1.4
 * Throttled: only log once per claim, skip rewrite if value already correct.
 */
(function (root) {
  'use strict';
  if (root.__SDLG_FB_FIX_V14__) return;
  root.__SDLG_FB_FIX_V14__ = true;

  var lastLogged = '';
  var lastClaim = '';

  function pick(c) {
    if (!c) return { person: '', contact: '' };
    var person = String(
      c.technical_personnel || c.feedback_person || c.technician || c.service_advisor || ''
    ).replace(/^\s*technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
    var contact = String(
      c.feedback_contact || c.contact_phone || c.phone || c.mobile || c.customer_phone || ''
    ).trim();
    if (/^kosong$/i.test(person) || person === '\u2014') person = '';
    if (/^kosong$/i.test(contact) || contact === '\u2014') contact = '';
    return { person: person, contact: contact };
  }

  function claimId() {
    try {
      if (root.__SDLG_LIVE_CLAIM__ && root.__SDLG_LIVE_CLAIM__.claim_id) return String(root.__SDLG_LIVE_CLAIM__.claim_id);
      var sels = document.querySelectorAll('select');
      for (var i = 0; i < sels.length; i++) {
        var v = String(sels[i].value || '').trim();
        if (/SDLG-PFR/i.test(v)) return v;
      }
    } catch (_) {}
    return '';
  }

  function fillField(id, labels, value) {
    var v = value == null ? '' : String(value);
    var el = document.getElementById(id);
    if (el) {
      if (String(el.value || '') !== v) {
        el.value = v;
        try { el.setAttribute('value', v); el.setAttribute('autocomplete', 'off'); } catch (_) {}
      }
    }
    labels.forEach(function (lab) {
      document.querySelectorAll('[data-sdlg-field]').forEach(function (node) {
        if ((node.getAttribute('data-label') || '') === lab) {
          if (String(node.value || '') !== v) {
            node.value = v;
            try { node.setAttribute('value', v); node.setAttribute('autocomplete', 'off'); } catch (_) {}
          }
        }
      });
    });
  }

  function run() {
    if (!document.querySelector('[data-sdlg-input-helper], #sdlg_feedbackPerson, [data-label="Feedback Person"]')) return;
    var id = claimId();
    if (!id) return;
    var live = root.__SDLG_LIVE_CLAIM__;
    var c = (live && live.claim_id === id) ? live : null;
    if (!c) return;
    var vals = pick(c);
    fillField('sdlg_feedbackPerson', ['Feedback Person'], vals.person);
    fillField('sdlg_feedbackContact', ['Feedback Contact Information', 'Feedback Contact'], vals.contact);
    if (lastLogged !== id + '|' + vals.person) {
      lastLogged = id + '|' + vals.person;
      try { console.info('[SDLG FB fix] filled', id, 'person=', vals.person || '(none)', 'contact=', vals.contact || '(none)'); } catch (_) {}
    }
    lastClaim = id;
  }

  var t = null;
  function schedule() {
    if (t) clearTimeout(t);
    t = setTimeout(run, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(function () { schedule(); });
    try { obs.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  root.addEventListener('hashchange', schedule);
  root.addEventListener('sdlg-input-claim', schedule);
  // slow heartbeat only — was 3s and spammed console
  setInterval(run, 8000);

  root.SDLGFeedbackPersonFix = { version: '1.4.0', run: run };
})(typeof window !== 'undefined' ? window : this);

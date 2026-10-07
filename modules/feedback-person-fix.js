/**
 * Runtime fix: Feedback Person field.
 * v1.1 — also fill empty/Kosong/xxx placeholders from claims.technical_personnel
 * (name only, no Technician prefix).
 */
(function () {
  'use strict';
  if (window.__SDLG_FB_PERSON_FIX_V11__) return;
  window.__SDLG_FB_PERSON_FIX_V11__ = true;

  function clean(v) { return v == null ? '' : String(v).trim(); }

  function feedbackPerson(claim) {
    var n = clean(claim && claim.technical_personnel);
    if (!n || /^unknown$/i.test(n)) return '';
    n = n.replace(/^technician\s*[\u2014\u2013\-:]\s*/i, '').trim();
    return n;
  }

  function isBroken(v) {
    var s = String(v || '');
    return s.indexOf('sdlgFeedbackPerson') >= 0 || s.indexOf('${') >= 0;
  }

  function isEmptyish(v) {
    var s = clean(v);
    return !s || s === '\u2014' || s === '-' || /^xxx+$/i.test(s) || /^kosong$/i.test(s) || /^unknown$/i.test(s);
  }

  function needsStrip(v) {
    return /^technician\s*[\u2014\u2013\-:]\s*/i.test(String(v || ''));
  }

  function findClaimId() {
    var t = document.body ? document.body.innerText : '';
    var m = t.match(/\b\d{4}-\d{4}-SDLG-PFR\b/);
    return m ? m[0] : '';
  }

  function findClient() {
    var names = ['sdlgSupabase', 'supabaseClient', 'sb', 'db', 'SDLGSupabase'];
    for (var i = 0; i < names.length; i++) {
      var c = window[names[i]];
      if (c && typeof c.from === 'function') return c;
    }
    return null;
  }

  function setFeedbackValue(person) {
    if (person == null) return;
    var nodes = document.querySelectorAll('input, textarea, [data-value]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var cur = el.value != null ? el.value : (el.getAttribute && el.getAttribute('data-value')) || '';
      var near = el.closest ? el.closest('div, section, form, label') : null;
      var nearText = near ? (near.innerText || '') : '';
      var isFbField = nearText.indexOf('Feedback Person') >= 0;
      if (!isFbField && !isBroken(cur) && !needsStrip(cur)) continue;
      if (!isBroken(cur) && !needsStrip(cur) && !isEmptyish(cur) && cur === person) continue;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (isBroken(cur) || needsStrip(cur) || isEmptyish(cur) || isFbField) {
          if (el.value !== person) {
            el.value = person;
            el.setAttribute('value', person);
            try {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (_) {}
          }
        }
      }
      if (el.getAttribute && el.getAttribute('data-value') != null) {
        if (isBroken(cur) || needsStrip(cur) || isEmptyish(cur) || isFbField) {
          el.setAttribute('data-value', person);
        }
      }
    }
    var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    while (walk.nextNode()) textNodes.push(walk.currentNode);
    for (var t = 0; t < textNodes.length; t++) {
      var node = textNodes[t];
      if (node.nodeValue && (isBroken(node.nodeValue) || needsStrip(node.nodeValue))) {
        node.nodeValue = person;
      }
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
      var person = feedbackPerson(res.data);
      var key = claimId + '|' + person;
      if (key === lastKey && !isBroken(bodyText) && bodyText.indexOf('Technician') < 0) {
        // still try fill if UI shows empty
        if (!person) return;
      }
      setFeedbackValue(person || '');
      lastKey = key;
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

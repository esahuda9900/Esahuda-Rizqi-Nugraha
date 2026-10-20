/**
 * VIN Auto Lookup Injector v2.1 (Final)
 * Target: Menimpa kolom "Serial No." dengan VIN lengkap dari Supabase.
 */
(function () {
  'use strict';
  
  var isProcessing = false;

  function log() {
    console.info.apply(console, ['[SDLG VIN Injector]', ...arguments]);
  }

  function getElementByLabel(labelText) {
    var labels = Array.prototype.slice.call(document.querySelectorAll('div, span, td, th, label'));
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      if (el.children.length > 0) continue;
      var text = (el.textContent || '').trim();
      if (text === labelText) {
         var parent = el.parentElement;
         if (parent && parent.children.length >= 2) {
            return parent.children[parent.children.length - 1];
         }
      }
    }
    return null;
  }

  function getValueByLabel(labelText) {
    var el = getElementByLabel(labelText);
    return el ? (el.textContent || '').trim() : null;
  }

  function setSerialToVIN(vin) {
    var valEl = getElementByLabel('Serial No.');
    if (valEl) {
       if (valEl.getAttribute('data-vin-updated') === '1') return;
       
       valEl.textContent = vin;
       valEl.style.color = '#065f46';
       valEl.style.backgroundColor = '#d1fae5';
       valEl.style.fontWeight = 'bold';
       valEl.style.padding = '2px 6px';
       valEl.style.borderRadius = '4px';
       valEl.style.display = 'inline-block';
       valEl.setAttribute('data-vin-updated', '1');
       
       log('✅ SUKSES! Serial No telah diubah menjadi VIN:', vin);
    }
  }

  function scanAndLookup() {
    if (isProcessing) return;
    
    var bodyText = document.body.innerText || '';
    if (bodyText.indexOf('HASIL PARSE') < 0 && bodyText.indexOf('IDENTIFIKASI') < 0) return;

    var model = getValueByLabel('Model');
    var serial = getValueByLabel('Serial No.');

    // Jika serial sudah panjang (VIN), abaikan
    if (serial && serial.length > 15) return;

    if (model && serial) {
       isProcessing = true;
       log('Memulai Lookup. Model Asli:', model, '| Serial:', serial);

       if (window.SDLGRepository && typeof window.SDLGRepository.lookupMachineVIN === 'function') {
         window.SDLGRepository.lookupMachineVIN(model, serial).then(function(vin) {
            if (vin) {
               setSerialToVIN(vin);
            } else {
               log('❌ VIN tidak ditemukan di database. Pastikan Model & Serial cocok.');
            }
            isProcessing = false;
         }).catch(function(err) {
            log('❌ Error:', err);
            isProcessing = false;
         });
       } else {
         log('❌ Error: Fungsi lookupMachineVIN tidak ditemukan.');
         isProcessing = false;
       }
    }
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var debounceTimer;
    var obs = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAndLookup, 600); 
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  setTimeout(scanAndLookup, 1000);

})();
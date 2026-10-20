/**
 * VIN Auto Lookup Injector v3.1 (React-Safe & Universal)
 */
(function () {
  'use strict';
  
  var isProcessing = false;

  function log() {
    console.info.apply(console, ['[SDLG VIN Injector]', ...arguments]);
  }

  // TRIK EXPERT: Memaksa React memperbarui nilai Input/Text
  function forceReactUpdate(el, value) {
    if (!el) return;
    var next = String(value);
    
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      try {
        var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        var desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, next);
        else el.value = next;
      } catch (_) { el.value = next; }
      try { el.setAttribute('value', next); el.defaultValue = next; } catch (_) {}
    } else {
      // Jika itu elemen teks biasa (div/span)
      el.textContent = next;
    }
  }

  // Pencarian DOM yang lebih pintar & presisi
  function findFieldElement(labelText) {
    var els = Array.prototype.slice.call(document.querySelectorAll('div, span, td, th, label, strong'));
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var text = (el.textContent || '').trim();
      
      // Cari label yang cocok
      if (text === labelText || text === labelText + ':') {
         var parent = el.parentElement;
         if (!parent) continue;
         
         // Cari saudara kandung (sibling) yang berisi nilainya
         for (var j = 0; j < parent.children.length; j++) {
             var sib = parent.children[j];
             if (sib === el) continue; // Lewati labelnya sendiri
             
             // Kembalikan elemen saudaranya (baik itu input atau div)
             var sibText = (sib.textContent || '').trim();
             if (sib.tagName === 'INPUT' || sib.tagName === 'TEXTAREA' || (sibText && sibText !== text && sibText.length < 50)) {
                 return sib;
             }
         }
         
         // Fallback: Jika struktur DOM-nya tabel (td berikutnya)
         if (parent.tagName === 'TD' || parent.tagName === 'TH') {
             var nextTd = parent.nextElementSibling;
             if (nextTd) return nextTd;
         }
      }
    }
    return null;
  }

  function getValueByLabel(labelText) {
    var el = findFieldElement(labelText);
    if (!el) return null;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value.trim();
    return (el.textContent || '').trim();
  }

  function setSerialToVIN(vin) {
    var valEl = findFieldElement('Serial No.');
    if (valEl) {
       if (valEl.getAttribute('data-vin-updated') === '1') return; // Sudah diubah
       
       // Gunakan trik React agar data tersimpan dengan benar
       forceReactUpdate(valEl, vin);
       
       // Beri efek visual hijau
       valEl.style.color = '#065f46';
       valEl.style.backgroundColor = '#d1fae5';
       valEl.style.fontWeight = 'bold';
       valEl.style.padding = '2px 6px';
       valEl.style.borderRadius = '4px';
       if (valEl.tagName !== 'INPUT') valEl.style.display = 'inline-block';
       
       valEl.setAttribute('data-vin-updated', '1');
       log('✅ BERHASIL! Serial No diubah menjadi:', vin);
    }
  }

  function scanAndLookup() {
    if (isProcessing) return;
    
    var bodyText = document.body.innerText || '';
    if (bodyText.indexOf('HASIL PARSE') < 0 && bodyText.indexOf('IDENTIFIKASI') < 0) return;

    // Cek dulu apakah elemen Serial sudah pernah diubah oleh script ini
    var serialEl = findFieldElement('Serial No.');
    if (serialEl && serialEl.getAttribute('data-vin-updated') === '1') return;

    var model = getValueByLabel('Model');
    var serial = getValueByLabel('Serial No.');

    // Jika serial sudah panjang (VIN), abaikan
    if (serial && serial.length > 15) return;

    if (model && serial) {
       isProcessing = true;
       log('1. Membaca layar -> Model:', model, '| Serial:', serial);

       if (window.SDLGRepository && typeof window.SDLGRepository.lookupMachineVIN === 'function') {
         window.SDLGRepository.lookupMachineVIN(model, serial).then(function(vin) {
            if (vin) {
               log('2. VIN diterima dari DB:', vin);
               setSerialToVIN(vin);
            } else {
               log('❌ 3. GAGAL: RPC tidak menemukan VIN untuk serial ini.');
            }
            isProcessing = false;
         }).catch(function(err) {
            log('❌ 3. ERROR saat lookup:', err);
            isProcessing = false;
         });
       } else {
         log('❌ Error: Fungsi lookupMachineVIN di repository tidak ada.');
         isProcessing = false;
       }
    } else {
       log('❌ Gagal membaca Model / Serial No. dari layar HTML.');
    }
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var debounceTimer;
    var obs = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAndLookup, 800); 
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  setTimeout(scanAndLookup, 1500);

})();
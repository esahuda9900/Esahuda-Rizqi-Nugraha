/**
 * SDLG Data Auto-Normalizer & VIN Injector v5.0
 * - Normalisasi Model & satuan (hr/km)
 * - Membersihkan tabel Parts (mengubah '—' jadi 0)
 * - Memaksa update ke memori global (window.__SDLG_LIVE_CLAIM__) jika ada
 */
(function () {
  'use strict';
  
  var isProcessing = false;
  var processedFields = {};

  function log() {
    console.info.apply(console, ['[SDLG Normalizer v5]', ...arguments]);
  }

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
      el.textContent = next;
    }
  }

  function findFieldElement(labelText) {
    var els = Array.prototype.slice.call(document.querySelectorAll('div, span, td, th, label, strong'));
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var text = (el.textContent || '').trim();
      if (text === labelText || text === labelText + ':') {
         if (el.tagName === 'TD' || el.tagName === 'TH') {
             var nextTd = el.nextElementSibling;
             if (nextTd) return nextTd;
         }
         var parent = el.parentElement;
         if (parent) {
             for (var j = 0; j < parent.children.length; j++) {
                 var sib = parent.children[j];
                 if (sib === el) continue; 
                 var sibText = (sib.textContent || '').trim();
                 if (sib.tagName === 'INPUT' || sib.tagName === 'TEXTAREA' || (sibText && sibText !== text && sibText.length < 50)) {
                     return sib;
                 }
             }
         }
      }
    }
    return null;
  }

  function cleanField(labelText, newValue) {
    if (processedFields[labelText]) return;
    var el = findFieldElement(labelText);
    if (el) {
       var currentVal = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.value : el.textContent;
       if (currentVal.trim() !== String(newValue)) {
           forceReactUpdate(el, newValue);
           el.style.color = '#065f46';
           el.style.backgroundColor = '#d1fae5';
           el.style.fontWeight = 'bold';
           el.style.padding = '2px 6px';
           el.style.borderRadius = '4px';
           if (el.tagName !== 'INPUT') el.style.display = 'inline-block';
           processedFields[labelText] = true;
       }
    }
  }

  function normalizeModel(m) {
    if (!m) return '';
    var s = String(m).toUpperCase().replace(/SDLG/gi, '').trim(); 
    s = s.replace(/\s+/g, ''); 
    if (/^\d/.test(s)) s = 'L' + s;
    return s;
  }

  // FUNGSI BARU: Membersihkan Tabel Parts
  function sanitizePartsTable() {
    // Cari tabel parts berdasarkan header "Failure Part No."
    var headers = Array.prototype.slice.call(document.querySelectorAll('th, div, span'));
    for (var i = 0; i < headers.length; i++) {
        if ((headers[i].textContent || '').indexOf('Failure Part No.') >= 0) {
            // Ketemu header, cari tabelnya
            var table = headers[i].closest('table');
            if (table) {
                var rows = table.querySelectorAll('tbody tr');
                rows.forEach(function(row) {
                    // Cari kolom harga (biasanya kolom ke-5 atau ada teks '—')
                    var cells = row.querySelectorAll('td');
                    cells.forEach(function(cell) {
                        var txt = (cell.textContent || '').trim();
                        if (txt === '—' || txt === '-' || txt === '') {
                            // Ubah jadi 0 agar valid untuk numeric di database
                            cell.textContent = '0';
                            cell.style.color = '#9ca3af'; // Warna abu-abu
                        }
                    });
                });
                log('✅ Tabel Parts berhasil dibersihkan (— menjadi 0)');
            }
            break;
        }
    }
  }

  function scanAndNormalize() {
    if (isProcessing) return;
    var bodyText = document.body.innerText || '';
    if (bodyText.indexOf('HASIL PARSE') < 0 && bodyText.indexOf('IDENTIFIKASI') < 0) return;

    isProcessing = true;

    try {
      // 1. Normalisasi Model
      var modelEl = findFieldElement('Model');
      if (modelEl) {
         var rawModel = (modelEl.tagName === 'INPUT' || modelEl.tagName === 'TEXTAREA') ? modelEl.value : modelEl.textContent;
         cleanField('Model', normalizeModel(rawModel));
      }

      // 2. Normalisasi Angka & Satuan
      var cleanNum = function(label) {
         var el = findFieldElement(label);
         if (el) {
            var val = (el.textContent || '').replace(/[^0-9.]/g, '');
            if (val) cleanField(label, val);
         }
      };

      cleanNum('HM Failure');
      cleanNum('HM Completion / Finish HM');
      cleanNum('HM Completion');
      cleanNum('Labour Hrs');
      cleanNum('Mileage Km');
      cleanNum('Mileage To Site');

      // 3. Engine Serial No
      var engSn = findFieldElement('Engine Serial No.');
      if (engSn) {
         var valSn = (engSn.textContent || '').replace(/^SN\.?\s*/i, '').trim();
         cleanField('Engine Serial No.', valSn);
      }

      // 4. Bersihkan Tabel Parts
      sanitizePartsTable();

      // 5. Sinkronisasi ke Memori Global (Jika aplikasi kamu pakai ini)
      if (window.__SDLG_LIVE_CLAIM__) {
          if (window.__SDLG_LIVE_CLAIM__.model) window.__SDLG_LIVE_CLAIM__.model = normalizeModel(window.__SDLG_LIVE_CLAIM__.model);
          if (window.__SDLG_LIVE_CLAIM__.labour_hrs) window.__SDLG_LIVE_CLAIM__.labour_hrs = String(window.__SDLG_LIVE_CLAIM__.labour_hrs).replace(/[^0-9.]/g, '');
          if (window.__SDLG_LIVE_CLAIM__.mileage_km) window.__SDLG_LIVE_CLAIM__.mileage_km = String(window.__SDLG_LIVE_CLAIM__.mileage_km).replace(/[^0-9.]/g, '');
          log('✅ Memori global __SDLG_LIVE_CLAIM__ disinkronkan.');
      }

    } catch (e) {
      console.warn('[SDLG Normalizer v5] Error:', e);
    } finally {
      isProcessing = false;
    }
  }

  if (typeof MutationObserver !== 'undefined' && document.body) {
    var debounceTimer;
    var obs = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAndNormalize, 800); 
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  setTimeout(scanAndNormalize, 1500);

})();
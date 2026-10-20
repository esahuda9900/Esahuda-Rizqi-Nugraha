/**
 * SDLG Data Auto-Normalizer & VIN Injector v7.0
 * - Menggabungkan Normalizer (Model, HM, Labour, dll)
 * - Mengembalikan Fitur VIN Lookup (RPC)
 * - Memperbaiki pembersihan Tabel Parts (— menjadi 0)
 */
(function () {
  'use strict';
  
  var isProcessing = false;
  var processedFields = {};

  function log() {
    console.info.apply(console, ['[SDLG v7.0]', ...arguments]);
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
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.textContent = next;
    }
  }

  function findFieldElement(labelText) {
    var elements = document.querySelectorAll('*');
    for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && el.textContent.trim() === labelText) {
            var parent = el.parentElement;
            if (el.tagName === 'TD' || el.tagName === 'TH') {
                if (el.nextElementSibling) return el.nextElementSibling;
            }
            if (el.nextElementSibling && el.nextElementSibling.textContent.trim().length > 0) {
                return el.nextElementSibling;
            }
            if (parent && parent.nextElementSibling && parent.nextElementSibling.textContent.trim().length > 0) {
                return parent.nextElementSibling;
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

  // PERBAIKAN TABEL PARTS: Mencari semua sel dan mengganti strip dengan 0
  function sanitizePartsTable() {
    var tables = document.querySelectorAll('table');
    var fixedCount = 0;
    tables.forEach(function(table) {
        // Pastikan ini tabel parts
        if ((table.textContent || '').indexOf('FAILURE PART NO.') > -1 || (table.textContent || '').indexOf('Failure Part No.') > -1) {
            var cells = table.querySelectorAll('td');
            cells.forEach(function(cell) {
                var txt = (cell.textContent || '').trim();
                if (txt === '—' || txt === '-' || txt === '') {
                    // Ubah jadi 0
                    cell.textContent = '0';
                    cell.style.color = '#065f46';
                    cell.style.fontWeight = 'bold';
                    fixedCount++;
                }
            });
        }
    });
    if (fixedCount > 0) log('✅ ' + fixedCount + ' sel Parts berhasil diubah menjadi 0');
  }

  function scanAndNormalize() {
    if (isProcessing) return;
    var bodyText = document.body.innerText || '';
    if (bodyText.indexOf('HASIL PARSE') < 0 && bodyText.indexOf('IDENTIFIKASI') < 0) return;

    isProcessing = true;

    try {
      // 1. Normalisasi Data Teks
      var modelEl = findFieldElement('Model');
      if (modelEl) {
         var rawModel = (modelEl.tagName === 'INPUT' || modelEl.tagName === 'TEXTAREA') ? modelEl.value : modelEl.textContent;
         cleanField('Model', normalizeModel(rawModel));
      }

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

      var engSn = findFieldElement('Engine Serial No.');
      if (engSn) {
         var valSn = (engSn.textContent || '').replace(/^SN\.?\s*/i, '').trim();
         cleanField('Engine Serial No.', valSn);
      }

      // 2. Bersihkan Tabel Parts
      sanitizePartsTable();

      // 3. VIN LOOKUP (Dikembalikan ke sini)
      var serialEl = findFieldElement('Serial No.');
      if (serialEl && serialEl.getAttribute('data-vin-updated') !== '1') {
          var rawSerial = (serialEl.tagName === 'INPUT' || serialEl.tagName === 'TEXTAREA') ? serialEl.value : serialEl.textContent;
          rawSerial = rawSerial.trim();
          
          if (rawSerial.length > 0 && rawSerial.length <= 15) {
             var rawModelText = modelEl ? ((modelEl.tagName === 'INPUT' || modelEl.tagName === 'TEXTAREA') ? modelEl.value : modelEl.textContent) : '';
             
             if (window.SDLGRepository && typeof window.SDLGRepository.lookupMachineVIN === 'function') {
                 window.SDLGRepository.lookupMachineVIN(rawModelText, rawSerial).then(function(vin) {
                    if (vin) {
                       forceReactUpdate(serialEl, vin);
                       serialEl.style.color = '#065f46';
                       serialEl.style.backgroundColor = '#d1fae5';
                       serialEl.style.fontWeight = 'bold';
                       serialEl.style.padding = '2px 6px';
                       serialEl.style.borderRadius = '4px';
                       if (serialEl.tagName !== 'INPUT') serialEl.style.display = 'inline-block';
                       serialEl.setAttribute('data-vin-updated', '1');
                       log('✅ VIN berhasil dimasukkan:', vin);
                    }
                 }).catch(function(e) { console.warn('VIN Lookup Error', e); });
             }
          } else if (rawSerial.length > 15) {
              // Jika sudah VIN, tandai saja
              serialEl.setAttribute('data-vin-updated', '1');
          }
      }

    } catch (e) {
      console.warn('[SDLG Normalizer v7.0] Error:', e);
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
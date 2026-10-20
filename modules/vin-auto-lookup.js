/**
 * SDLG Data Auto-Normalizer & VIN Injector v6.0 (X-Ray Vision)
 * Fixes: DOM targeting for Model, HM, Labour, Mileage, Engine SN, and Parts Table.
 */
(function () {
  'use strict';
  
  var isProcessing = false;
  var processedFields = {};

  function log() {
    console.info.apply(console, ['[SDLG Normalizer v6]', ...arguments]);
  }

  // Fungsi memaksa React update (termasuk trigger event input)
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
      
      // Trigger event agar React sadar ada perubahan
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.textContent = next;
    }
  }

  // Pencarian DOM yang jauh lebih agresif & presisi
  function findFieldElement(labelText) {
    var elements = document.querySelectorAll('*');
    for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        // Cek apakah elemen ini berisi teks persis seperti label
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && el.textContent.trim() === labelText) {
            var parent = el.parentElement;
            
            // Skenario 1: Label ada di dalam tabel (td), value ada di td sebelahnya
            if (el.tagName === 'TD' || el.tagName === 'TH') {
                if (el.nextElementSibling) return el.nextElementSibling;
            }
            
            // Skenario 2: Label dan value ada di div bersebelahan
            if (el.nextElementSibling && el.nextElementSibling.textContent.trim().length > 0) {
                return el.nextElementSibling;
            }
            
            // Skenario 3: Label di dalam div, value di div sebelah parent
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
           log('✨ ' + labelText + ' -> ' + newValue);
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

  // FUNGSI BARU: Membersihkan Tabel Parts (Mengubah '—' jadi '0')
  function sanitizePartsTable() {
    // Cari semua tabel
    var tables = document.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
        var table = tables[i];
        if ((table.textContent || '').indexOf('Failure Part No.') > -1) {
            // Kita temukan tabel Parts
            var rows = table.querySelectorAll('tbody tr, tr');
            rows.forEach(function(row) {
                var cells = row.querySelectorAll('td');
                // Kolom Unit Price biasanya index ke-4 (0: Failure, 1: Replacement, 2: Desc, 3: Qty, 4: Price)
                if (cells.length >= 5) {
                    var priceCell = cells[4]; 
                    if (priceCell.textContent.trim() === '—' || priceCell.textContent.trim() === '-') {
                        priceCell.textContent = '0';
                        priceCell.style.color = '#065f46';
                        priceCell.style.fontWeight = 'bold';
                        log('✅ Parts Unit Price diubah dari — menjadi 0');
                    }
                }
            });
            break; // Selesai jika tabel parts sudah ketemu
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

    } catch (e) {
      console.warn('[SDLG Normalizer v6] Error:', e);
    } finally {
      isProcessing = false;
    }
  }

  // Observer untuk memantau perubahan DOM
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var debounceTimer;
    var obs = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAndNormalize, 800); 
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Jalankan pertama kali
  setTimeout(scanAndNormalize, 1500);

})();
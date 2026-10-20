/**
 * VIN Auto Lookup Injector v1.0
 * Berjalan di background, mendeteksi jika ada "Hasil Parse", lalu menembak RPC VIN.
 */
(function () {
  'use strict';
  
  var IS_DEBUG = window.location.search.indexOf('debug=true') > -1;
  var isProcessing = false;

  function log() {
    if (IS_DEBUG) console.info.apply(console, ['[SDLG VIN Injector]', ...arguments]);
  }

  // Fungsi untuk mencari nilai teks di sebelah label
  function getValueByLabel(labelText) {
    var labels = Array.prototype.slice.call(document.querySelectorAll('div, span, td, th, label'));
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      if (el.children.length > 0) continue; // Hanya cek elemen daun (paling ujung)
      
      var text = (el.textContent || '').trim();
      if (text === labelText) {
         // Cari value di sebelah kanannya (biasanya elemen bersebelahan atau div di parent yang sama)
         var parent = el.parentElement;
         if (parent && parent.children.length >= 2) {
            // Ambil elemen terakhir sebagai value
            var valEl = parent.children[parent.children.length - 1];
            return (valEl.textContent || '').trim();
         }
      }
    }
    return null;
  }

  // Fungsi untuk mengisi nilai VIN ke kolom UI
  function setVINValue(vin) {
    var labels = Array.prototype.slice.call(document.querySelectorAll('div, span, td, th, label'));
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      var text = (el.textContent || '').trim();
      
      // Mencari label "Indent / Machine Build No." atau yang sejenis
      if (/Indent.*Machine Build No/i.test(text)) {
         var parent = el.parentElement;
         if (parent && parent.children.length >= 2) {
            var valEl = parent.children[parent.children.length - 1];
            // Cek apakah masih kosong atau berisi strip
            var currentVal = (valEl.textContent || '').trim();
            if (!currentVal || currentVal === '—' || currentVal === '-') {
               valEl.textContent = vin;
               valEl.style.color = '#10b981'; // Warna hijau tanda berhasil
               valEl.style.fontWeight = 'bold';
               log('VIN injected successfully:', vin);
            }
         }
      }
    }
  }

  // Fungsi utama pemantau DOM
  function scanAndLookup() {
    if (isProcessing) return;
    
    // Cek apakah halaman hasil parse sudah muncul
    var bodyText = document.body.innerText || '';
    if (bodyText.indexOf('HASIL PARSE') < 0 && bodyText.indexOf('IDENTIFIKASI') < 0) return;

    // Ambil Model & Serial dari layar
    var model = getValueByLabel('Model');
    var serial = getValueByLabel('Serial No.');

    if (model && serial) {
       // Cek apakah VIN sudah terisi
       var vinField = getValueByLabel('Indent / Machine Build No.');
       if (vinField && vinField !== '—' && vinField !== '-' && vinField.length > 5) {
           // Jika sudah terisi (mungkin dari hasil parse mentah), kita bisa lewati atau timpa. 
           // Untuk aman, kita biarkan jika isinya sesuai format VIN.
           return; 
       }

       isProcessing = true;
       log('Looking up VIN for:', model, serial);

       if (window.SDLGRepository && typeof window.SDLGRepository.lookupMachineVIN === 'function') {
         window.SDLGRepository.lookupMachineVIN(model, serial).then(function(vin) {
            if (vin) {
               setVINValue(vin);
            } else {
               log('VIN not found in database for:', serial);
            }
            isProcessing = false;
         }).catch(function(err) {
            log('Lookup error:', err);
            isProcessing = false;
         });
       } else {
         log('Error: SDLGRepository.lookupMachineVIN is not loaded.');
         isProcessing = false;
       }
    }
  }

  // Pantau perubahan layar
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var debounceTimer;
    var obs = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAndLookup, 500); // Tunggu 500ms agar React selesai render
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Panggil sekali saat load
  setTimeout(scanAndLookup, 1000);

})();
/**
 * Future app entry (Phase F). Safe no-op until thin index lands.
 * Do not replace production mount from here yet.
 *
 * Contract: classic script (no import/export) so verify-module-syntax.js
 * and Cloudflare static <script> load stay green.
 */
(function () {
  'use strict';

  async function boot() {
    if (typeof console !== 'undefined') {
      console.info('[SDLG] boot.js loaded — shell still owned by index.html until Phase F');
    }
    return { ok: true, phase: 'scaffold' };
  }

  if (typeof window !== 'undefined') {
    window.SDLGBoot = { boot: boot, version: '0.1.0-scaffold' };
  }
})();

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(htmlPath, 'utf8');

const marker = 'SDLG_WO_SAVE_FALLBACK_V1';
if (source.includes(marker)) {
  console.log('WO save fallback already present.');
  process.exit(0);
}

const runtime = `<!-- ${marker} -->
<script>
(() => {
  if (window.__sdlgWoSaveFallbackV1) return;
  window.__sdlgWoSaveFallbackV1 = true;

  const originalFetch = window.fetch;

  const isUpdateClaimRpc = (url) => {
    try {
      return String(url || '').includes('/rest/v1/rpc/update_sdlg_claim');
    } catch (_) {
      return false;
    }
  };

  const extractBody = (input, init) => {
    if (init && typeof init.body === 'string') return init.body;
    if (input && typeof input === 'object' && typeof input.body === 'string') return input.body;
    return null;
  };

  const buildRetryRequest = (input, init, body) => {
    const parsed = JSON.parse(body);
    const claim = parsed && parsed.p_claim;
    if (!parsed || !claim || typeof claim !== 'object') return null;

    const wo = typeof claim.dealer_wo_so === 'string' ? claim.dealer_wo_so.trim() : '';
    const claimId = typeof parsed.p_claim_id === 'string' ? parsed.p_claim_id.trim() : '';
    if (!wo || !claimId) return null;

    // Narrow recovery: persist only the corrected WO/SO.
    // Do not resend the full claim payload, which is what may have failed validation.
    const retryPayload = JSON.stringify({
      p_claim_id: claimId,
      p_claim: { dealer_wo_so: wo },
      p_status_history: []
    });

    if (init && typeof init === 'object') {
      return { input, init: { ...init, body: retryPayload }, body: retryPayload };
    }

    if (input instanceof Request) {
      return { input: new Request(input, { body: retryPayload }), init: undefined, body: retryPayload };
    }

    return { input, init: { method: 'POST', body: retryPayload }, body: retryPayload };
  };

  window.fetch = async function(input, init) {
    const url = input && typeof input === 'object' && 'url' in input ? input.url : input;

    if (!isUpdateClaimRpc(url)) {
      return originalFetch.apply(this, arguments);
    }

    const body = extractBody(input, init);
    let firstResponse;
    try {
      firstResponse = await originalFetch.apply(this, arguments);
    } catch (err) {
      throw err;
    }

    if (firstResponse.ok || !body) return firstResponse;

    try {
      const retry = buildRetryRequest(input, init, body);
      if (!retry) return firstResponse;

      const retryResponse = await originalFetch.call(this, retry.input, retry.init);
      if (retryResponse.ok) {
        console.warn('[SDLG] Full claim save failed; WO/SO-only recovery succeeded.');
        return retryResponse;
      }
    } catch (err) {
      console.warn('[SDLG] WO/SO recovery skipped:', err);
    }

    return firstResponse;
  };
})();
</script>`;

const pos = source.lastIndexOf('</body>');
if (pos < 0) throw new Error('Expected </body> was not found; refusing unsafe WO save fallback patch.');

source = source.slice(0, pos) + runtime + '\n' + source.slice(pos);
fs.writeFileSync(htmlPath, source);
console.log('Applied SDLG WO/SO save fallback v1.');

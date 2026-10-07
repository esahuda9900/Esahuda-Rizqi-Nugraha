const fs = require('node:fs');
const cp = require('node:child_process');

const realExecFileSync = cp.execFileSync;
const liveBase = 'https://negative-test.invalid/';
const livePath = process.env.NEGATIVE_TEST_LIVE_HTML_PATH;
const mutateLive = process.env.NEGATIVE_TEST_MUTATE_LIVE === 'true';
const cloudflareCommit = process.env.NEGATIVE_TEST_CLOUDFLARE_COMMIT;
const blockedCommit = process.env.NEGATIVE_TEST_BLOCKED_GIT_COMMIT || '';

function jsonResponse(result) {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function liveBytes() {
  const bytes = Buffer.from(fs.readFileSync(livePath));
  if (mutateLive) {
    const index = Math.max(0, bytes.length - 1);
    bytes[index] = bytes[index] ^ 1;
  }
  return bytes;
}

global.fetch = async function mockedFetch(input) {
  const url = typeof input === 'string' ? input : String(input?.url || input);

  if (url === liveBase) {
    return new Response(liveBytes(), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cf-cache-status': 'MOCK',
      },
    });
  }

  const prefix = 'https://api.cloudflare.com/client/v4';
  if (!url.startsWith(prefix)) {
    throw new Error('Unexpected external fetch in negative-test harness: ' + url);
  }

  if (/\/workers\/scripts\/[^/]+\/deployments/.test(url)) {
    return jsonResponse({
      deployments: [{ id: 'negative-test-deployment', versions: [{ version_id: 'negative-test-version' }] }],
    });
  }

  if (/\/workers\/scripts$/.test(url)) {
    return jsonResponse([{ id: 'sdlg-warranty-backup', tag: 'negative-test-worker-tag' }]);
  }

  if (/\/builds\/workers\/negative-test-worker-tag\/triggers$/.test(url)) {
    return jsonResponse([{
      trigger_uuid: 'negative-test-trigger',
      trigger_name: 'production',
      branch_includes: ['main'],
    }]);
  }

  if (/\/builds\/triggers\/negative-test-trigger\/environment_variables$/.test(url)) {
    return jsonResponse({
      NODE_VERSION: { value: '22' },
      PNPM_VERSION: { value: '10.11.1' },
    });
  }

  if (/\/builds\/workers\/negative-test-worker-tag\/builds\?/.test(url)) {
    return jsonResponse([{
      build_uuid: 'negative-test-build',
      build_outcome: 'success',
      created_on: '2099-01-01T00:00:00.000Z',
      build_trigger_metadata: {
        commit_hash: cloudflareCommit,
        build_command: 'pnpm install --no-frozen-lockfile && npm run build',
        deploy_command: 'npx wrangler deploy',
      },
    }]);
  }

  throw new Error('Unexpected Cloudflare API fetch in negative-test harness: ' + url);
};

cp.execFileSync = function patchedExecFileSync(file, args, options) {
  const argv = Array.isArray(args) ? args.map(String) : [];
  if (
    blockedCommit &&
    file === 'git' &&
    argv[0] === 'fetch' &&
    argv.includes(blockedCommit)
  ) {
    throw new Error('NEGATIVE TEST BLOCK: Cloudflare commit intentionally unavailable in repo: ' + blockedCommit);
  }
  return realExecFileSync.call(this, file, args, options);
};

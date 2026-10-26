const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'modules/sdlg-repository.js'), 'utf8');

async function verifyRepository(inline) {
  const calls = [];
  let outcome;
  const client = {rpc: async (name, body) => {
    calls.push({name, body});
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }};
  const context = {console: {info() {}}, sdlgSupabase: client, getSdlgSupabase: () => client};
  context.window = context;
  vm.createContext(context);
  if (inline) {
    const a = html.indexOf('        async updateClaim(command) {');
    const b = html.indexOf('        async updateStatus(command)', a);
    assert.ok(a > 0 && b > a);
    vm.runInContext('globalThis.repo = ({' + html.slice(a, b) + '});', context);
  } else {
    vm.runInContext(source, context);
    context.repo = context.SDLG_REPOSITORY;
  }
  const command = {claimId: 'FIXTURE', claim: {
    dealer_wo_so: 'WO-FIXTURE', fault_description: 'FULL EDIT',
    _expected_last_updated: '2026-10-26T00:00:00Z'
  }, statusHistory: [{status: 'Draft'}]};
  for (const response of [
    {error: {code: '40001', message: 'conflict'}, status: 409},
    {error: {message: 'validation'}, status: 400},
    {error: {message: 'Failed to fetch'}, status: 0},
    new Error('network offline'), null
  ]) {
    outcome = response;
    const before = calls.length;
    await assert.rejects(() => context.repo.updateClaim(command));
    assert.equal(calls.length, before + 1, 'one complete request, no retries');
    assert.deepEqual(calls.at(-1).body.p_claim, command.claim);
    assert.deepEqual(calls.at(-1).body.p_status_history, command.statusHistory);
  }
  const before = calls.length;
  await assert.rejects(() => context.repo.updateClaim({...command, claim: {dealer_wo_so: 'WO-FIXTURE'}}));
  assert.equal(calls.length, before, 'missing optimistic version must not send a request');
  outcome = {error: null, data: null, status: 204};
  assert.equal(await context.repo.updateClaim(command), true);
}

async function verifyEditor(outcome, validationFails = false, refreshFails = false) {
  const a = html.indexOf('    const saveEdit = async () => {');
  const b = html.indexOf('    useEffect(() => { if (tab === "list" && detailId)', a);
  assert.ok(a > 0 && b > a);
  const draft = {parts: [], model: 'MODEL', serial_no: 'SERIAL', fault_description: 'UNSAVED DRAFT'};
  const before = JSON.stringify(draft);
  let requests = 0, refreshes = 0, editing = true;
  const messages = [];
  const context = {
    detail: {claim_id: 'FIXTURE', claim_status: 'Draft', last_updated: '2026-10-26T00:00:00Z'},
    saving: false, saveInFlightRef: {current: false}, editForm: draft,
    navigator: {onLine: true}, validateParsed: () => validationFails ? ['fixture invalid'] : [],
    cleanText: value => String(value || '').trim(), BUSINESS_RULES: {},
    autoWorkflowFromFields: () => [], setSaving: value => {context.saving = value;},
    setEditing: value => {editing = value;}, showToast: value => messages.push(value),
    SDLG_USE_CASES: {UpdateClaimRecord: {execute: async () => {
      requests++;
      if (outcome) throw outcome;
    }}},
    loadClaims: async () => {refreshes++; if (refreshFails) throw new Error('refresh failed');}
  };
  vm.createContext(context);
  vm.runInContext(html.slice(a, b) + '\nglobalThis.save = saveEdit;', context);
  await context.save();
  assert.equal(JSON.stringify(draft), before, 'draft must remain intact');
  assert.equal(context.saveInFlightRef.current, false, 'save gate released on every exit');
  assert.equal(context.saving, false);
  if (outcome || validationFails) {
    assert.equal(editing, true);
    assert.equal(refreshes, 0, 'failed mutation must not refresh over draft');
    assert.equal(requests, validationFails ? 0 : 1);
    assert.ok(!messages.some(x => x.includes('✅')));
  } else {
    assert.equal(editing, false);
    assert.equal(refreshes, 1);
    assert.equal(requests, 1);
  }
  if (refreshFails) assert.ok(messages.at(-1).includes('berhasil disimpan'));
}

(async () => {
  assert.ok(!html.includes('SDLG_WO_SAVE_FALLBACK_V1'));
  assert.ok(!html.includes('__sdlgWoSaveFallbackV1'));
  for (const inline of [false, true]) await verifyRepository(inline);
  await verifyEditor(Object.assign(new Error('conflict'), {code: '40001', status: 409}));
  await verifyEditor(Object.assign(new Error('Failed to fetch'), {status: 0}));
  await verifyEditor(new Error('validation rejected'));
  await verifyEditor(null, true);
  await verifyEditor(null);
  await verifyEditor(null, false, true);
  console.log('SAVE INTEGRITY: PASS (both repositories, no partial retry, version gate, draft preservation, lock cleanup, honest refresh failure)');
})().catch(error => {console.error(error); process.exitCode = 1;});

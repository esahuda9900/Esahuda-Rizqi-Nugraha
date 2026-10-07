/**
 * Wire claim detailId + tab persistence across browser refresh.
 * Depends on modules/navigation-state.js (SDLGNavState.restoreDetailId / persist).
 *
 * Important: detailId persistence MUST be declared after the detailId state is
 * initialized, otherwise the dependency array evaluates in the temporal dead zone.
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
let changes = 0;
const NL = String.fromCharCode(10);

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    console.warn('[nav-detail] skip (not found):', label);
    return;
  }
  if (source.includes(to)) {
    console.log('[nav-detail] already:', label);
    return;
  }
  source = source.replace(from, to);
  changes += 1;
  console.log('[nav-detail] applied:', label);
}

const legacyState = 'const [detailId, setDetailId] = useState(null);';
const restoredState = [
  'const [detailId, setDetailId] = useState(() => (typeof window !== "undefined" && window.SDLGNavState && typeof window.SDLGNavState.restoreDetailId === "function" ? window.SDLGNavState.restoreDetailId() : null));',
  '    useEffect(() => {',
  '        try { window.SDLGNavState?.persist(tab, null, detailId); } catch (_) {}',
  '    }, [tab, detailId]);'
].join(NL);

replaceOnce(
  'detailId restore + post-init persistence',
  legacyState,
  restoredState
);

const unsafeTopEffect = [
  '    useEffect(() => {',
  '        try { window.SDLGNavState?.persist(tab, null, detailId); } catch (_) {}',
  '    }, [tab, detailId]);'
].join(NL);

const safeTopEffect = [
  '    useEffect(() => {',
  '        try { window.SDLGNavState?.persist(tab); } catch (_) {}',
  '    }, [tab]);'
].join(NL);

replaceOnce('remove unsafe top-level detailId dependency', unsafeTopEffect, safeTopEffect);

const detailStateNeedle = 'const [detailId, setDetailId] = useState(() => (';
const detailPersistNeedle = 'window.SDLGNavState?.persist(tab, null, detailId);';

function assertNoDetailIdTdz() {
  const stateAt = source.indexOf(detailStateNeedle);
  const persistAt = source.indexOf(detailPersistNeedle);
  if (stateAt < 0) throw new Error('[nav-detail] restored detailId state was not emitted');
  if (persistAt < 0) throw new Error('[nav-detail] detailId persistence effect was not emitted');
  if (persistAt <= stateAt) {
    throw new Error('[nav-detail] REFUSED: detailId persistence appears before detailId initialization (TDZ risk)');
  }
}

if (changes === 0) {
  console.log('[nav-detail] no changes');
  process.exit(0);
}

assertNoDetailIdTdz();

fs.writeFileSync(file, source);
console.log('[nav-detail] wrote changes=', changes);

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');
const original = html;
let changes = 0;

function countReplace(search, replace, label) {
  if (!html.includes(search)) {
    console.log('skip (not found):', label);
    return 0;
  }
  const n = html.split(search).length - 1;
  html = html.split(search).join(replace);
  changes += n;
  console.log('patched', n, 'x:', label);
  return n;
}

// ONLY repair the known broken assignment (quoted template → live call).
countReplace(
  'const defaultFeedbackPerson = "${sdlgFeedbackPerson(selectedClaim)}";',
  'const defaultFeedbackPerson = sdlgFeedbackPerson(selectedClaim);',
  'quoted template → live call'
);
countReplace(
  "const defaultFeedbackPerson = '${sdlgFeedbackPerson(selectedClaim)}';",
  'const defaultFeedbackPerson = sdlgFeedbackPerson(selectedClaim);',
  'quoted template single → live call'
);

html = html.replace(
  /(\b(?:value|defaultValue)\s*:\s*)(["'])\$\{sdlgFeedbackPerson\(selectedClaim\)\}\2/g,
  '$1sdlgFeedbackPerson(selectedClaim)'
);
if (html !== original) changes += 1;

const HELPER_MARK = '/* SDLG_FB_PERSON_HELPER */';
if (!html.includes(HELPER_MARK)) {
  // Name only — no "Technician — " prefix (user requirement)
  const helper = [
    HELPER_MARK,
    'function sdlgFeedbackPerson(claim){',
    '  try {',
    '    var n = String((claim && claim.technical_personnel) || "").trim();',
    '    if (!n || /^unknown$/i.test(n)) return "";',
    '    n = n.replace(/^technician\\s*[—–-]\\s*/i, "").trim();',
    '    return n;',
    '  } catch (e) { return ""; }',
    '}'
  ].join('\n');
  const scriptOpen = html.indexOf('<script>');
  if (scriptOpen >= 0) {
    const insertAt = html.indexOf('>', scriptOpen) + 1;
    html = html.slice(0, insertAt) + '\n' + helper + '\n' + html.slice(insertAt);
    changes += 1;
    console.log('injected sdlgFeedbackPerson helper (name-only)');
  }
} else {
  // Upgrade existing helper if it still returns Technician prefix
  if (/return\s+["']Technician/.test(html) && html.includes(HELPER_MARK)) {
    html = html.replace(
      /function sdlgFeedbackPerson\(claim\)\{[\s\S]*?\n\}/,
      [
        'function sdlgFeedbackPerson(claim){',
        '  try {',
        '    var n = String((claim && claim.technical_personnel) || "").trim();',
        '    if (!n || /^unknown$/i.test(n)) return "";',
        '    n = n.replace(/^technician\\s*[—–-]\\s*/i, "").trim();',
        '    return n;',
        '  } catch (e) { return ""; }',
        '}'
      ].join('\n')
    );
    changes += 1;
    console.log('upgraded sdlgFeedbackPerson helper to name-only');
  }
}

if (html === original) {
  console.log('No textual changes applied.');
} else {
  fs.writeFileSync(file, html);
  console.log('Wrote index.html, change units:', changes, 'size', html.length);
}

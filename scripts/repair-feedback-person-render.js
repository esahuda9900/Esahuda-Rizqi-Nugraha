const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(file, 'utf8');
const original = html;

// The legacy Feedback Person patch accidentally emitted a template expression as a
// quoted string. In React.createElement props this becomes literal UI text instead
// of an evaluated value. Repair only value/defaultValue props so runtime helper calls
// remain executable JavaScript.
const quotedExpr = /(\b(?:value|defaultValue)\s*:\s*)(["'])\$\{sdlgFeedbackPerson\(selectedClaim\)\}\2/g;
html = html.replace(quotedExpr, '$1sdlgFeedbackPerson(selectedClaim)');

// Repair placeholder output left by the legacy patch when it is used as an input value.
const quotedPlaceholder = /(\b(?:value|defaultValue)\s*:\s*)(["'])__SDLG_FB_PLACEHOLDER__\2/g;
html = html.replace(quotedPlaceholder, '$1sdlgFeedbackPerson(selectedClaim)');

// Same repair for the old hardcoded technician value if it survived in a value prop.
const quotedLegacyPerson = /(\b(?:value|defaultValue)\s*:\s*)(["'])Technician\s*[—–-]\s*Akhsana Taqwim\2/g;
html = html.replace(quotedLegacyPerson, '$1sdlgFeedbackPerson(selectedClaim)');

const leakedValue = /\b(?:value|defaultValue)\s*:\s*["']\$\{sdlgFeedbackPerson\(selectedClaim\)\}["']/;
if (leakedValue.test(html)) {
  throw new Error('Feedback Person runtime expression is still emitted as a quoted literal.');
}

if (html === original) {
  console.log('Feedback Person render repair: no changes needed.');
} else {
  fs.writeFileSync(file, html);
  console.log('Feedback Person render repair: quoted helper expression converted to executable value prop.');
}

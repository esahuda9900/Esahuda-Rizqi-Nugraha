const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');

// Preserve numeric zero in display fallbacks while retaining the normal
// blank/null fallback. Supports minified member access and optional chaining.
const member = String.raw`(?:[A-Za-z_$][\w$]*)(?:(?:\?\.)|\.)(?:[A-Za-z_$][\w$]*)(?:\.(?:[A-Za-z_$][\w$]*))*`;
const bare = String.raw`(?:[A-Za-z_$][\w$]*)`;
const lhs = String.raw`(?:${member}|${bare})`;

const patterns = [
  new RegExp(`(${lhs})\\s*\\|\\|\\s*(['"])—\\2`, 'g'),
  new RegExp(`(${lhs})\\s*\\|\\|\\s*(['"])\\-\\2`, 'g')
];

let matches = 0;
for (const re of patterns) {
  const found = source.match(re);
  if (found) matches += found.length;
  source = source.replace(re, '($1 === 0 ? 0 : ($1 || $2—$2))');
}

if (matches === 0) {
  console.log('Zero-display fix: no direct identifier fallback matched; bundle left unchanged.');
  process.exit(0);
}

fs.writeFileSync(file, source);
console.log(`Applied zero-display fix: ${matches} numeric fallback(s) now preserve 0 while blanks still use the dash.`);

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(htmlPath, 'utf8');

let changed = false;

function indexHasHead(src) {
  return typeof src === 'string' && src.includes('</head>') && src.length > 1000000;
}

if (!indexHasHead(source)) {
  console.error(
    'index.html is missing or corrupt (no </head> / too small). ' +
      'build-production.js should self-heal from production before this step. ' +
      'Refusing parts-parser patches on a broken shell.'
  );
  process.exit(1);
}

const helperScript = '<script src="/modules/claim-parser-helpers.js"></script>';
if (!source.includes(helperScript)) {
  const anchor = '<script src="/modules/export-table-helper.js"></script>';
  if (source.includes(anchor)) {
    source = source.replace(anchor, `${helperScript}\n${anchor}`);
  } else {
    const headClose = '</head>';
    source = source.replace(headClose, `  ${helperScript}\n${headClose}`);
  }
  changed = true;
}

const inlineNumericPattern = 'const isNumericCell = v => /^[+-]?(?:\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d+)?$/.test(cleanSourceCell(v));';
const inlineNumericReplacement = 'const isNumericCell = window.SDLGClaimParserHelpers.isNumericCell;';
if (source.includes(inlineNumericReplacement) || source.includes('SDLGClaimParserHelpers.isNumericCell')) {
  console.log('Numeric-cell parser helper already delegated to module.');
} else if (source.includes(inlineNumericPattern)) {
  source = source.replace(inlineNumericPattern, inlineNumericReplacement);
  changed = true;
  console.log('Extracted numeric-cell parser predicate to /modules/claim-parser-helpers.js.');
} else {
  console.warn('Expected inline numeric-cell parser predicate was not found; leaving unchanged.');
}

const oldPart = 'if (!((looksPartNo(fp) || looksPartNo(rp)) && qty != null && Number(qty) > 0)) continue;';
const newPart = `if (!(looksPartNo(fp) || looksPartNo(rp) || desc)) continue;
        // Qty is source data, not a validity gate. Zero/blank Qty is still a valid
        // part row when the source contains a part number and/or description.
        // Keep numeric zero as a real value instead of dropping the row.`;

if (source.includes(newPart) || source.includes('Zero/blank Qty is still a valid') || source.includes('SDLG_ALLOW_ZERO_PART_QTY')) {
  console.log('Parts parser fix already present.');
} else if (source.includes(oldPart)) {
  source = source.replace(oldPart, newPart);
  changed = true;
  console.log('Applied SDLG parts parser fix: zero/blank quantity no longer drops valid part rows.');
} else {
  console.warn('Parts zero-qty legacy gate not found; leaving unchanged.');
}

const regexPatterns = [
  { old: '/Mileage To Site\\s*=\\s*([0-9.,]+)/i', next: '/(?:Mileage|Milage) To Site\\s*=\\s*([0-9.,]+)/i' },
  { old: '/Mileage To Site\\s*=\\s*([0-9.,]+)/g', next: '/(?:Mileage|Milage) To Site\\s*=\\s*([0-9.,]+)/g' },
  { old: '/Mileage To Site\\s*=\\s*([0-9.,]+)/', next: '/(?:Mileage|Milage) To Site\\s*=\\s*([0-9.,]+)/' },
  { old: '/^Mileage To Site\\s*=/i', next: '/^(?:Mileage|Milage) To Site\\s*=/i' }
];

let regexCount = 0;
for (const p of regexPatterns) {
  const n = source.split(p.old).length - 1;
  if (n > 0) {
    source = source.split(p.old).join(p.next);
    changed = true;
    regexCount += n;
  }
}

const fieldAliasOld = 'mileageToSite:["Mileage To Site"]';
const fieldAliasNew = 'mileageToSite:["Mileage To Site","Milage To Site"]';
if (source.includes(fieldAliasOld)) {
  source = source.split(fieldAliasOld).join(fieldAliasNew);
  changed = true;
}

const knownLabelOld = '"Mileage To Site",\n            "Finish Hour Meter"';
const knownLabelNew = '"Mileage To Site", "Milage To Site",\n            "Finish Hour Meter"';
if (source.includes(knownLabelOld)) {
  source = source.split(knownLabelOld).join(knownLabelNew);
  changed = true;
}

if (regexCount > 0) {
  console.log(`Applied Mileage To Site parser fix: regex=${regexCount}.`);
} else if (source.includes('Milage To Site') || source.includes('/(?:Mileage|Milage) To Site')) {
  console.log('Mileage To Site parser and label aliases already present.');
} else {
  console.warn('Mileage To Site patterns not found; leaving unchanged.');
}

// Money harden — best effort, never abort the build
const moneyMarker = '/* SDLG_MONEY_HARDEN_V1 */';
if (source.includes(moneyMarker)) {
  console.log('Money harden already applied.');
} else {
  try {
    const newParseCellMoney =
      moneyMarker +
      '\n    const parseCellMoney = (v) => {\n' +
      '        const H = window.SDLGClaimParserHelpers;\n' +
      '        if (H && typeof H.parseCellMoney === "function") return H.parseCellMoney(v);\n' +
      '        const x = cleanSourceCell(v);\n' +
      '        if (!x) return null;\n' +
      '        if (/^(?:(?:USD|CNY|IDR|RP|RMB)\\s*)?(?:[¥￥$])?\\s*[-–—]+$/i.test(x) || /^[-–—]+$/.test(x)) return 0;\n' +
      '        if (/\\bSN\\.?\\s*\\d+/i.test(x) || /[A-Za-z]/.test(x)) return null;\n' +
      '        return parseSourceNumber(x);\n' +
      '    }';

    const pcmStart = source.indexOf('const parseCellMoney = (v) => {');
    if (pcmStart < 0) throw new Error('parseCellMoney not found');
    const braceStart = source.indexOf('{', pcmStart);
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0 || end - pcmStart > 1200) throw new Error('parseCellMoney span invalid');
    source = source.slice(0, pcmStart) + newParseCellMoney + source.slice(end);
    changed = true;
    console.log('parseCellMoney delegated to claim-parser-helpers.');

    const partsNeedle = 'if (/PARTS\\s+TOTAL/i.test(line))';
    let partsBlockStart = source.indexOf(partsNeedle);
    if (partsBlockStart < 0) {
      const assignAt = source.indexOf('out.partsTotal = n');
      if (assignAt > 0) partsBlockStart = source.lastIndexOf('for (let r = i', assignAt);
    }
    if (partsBlockStart >= 0) {
      const forStart = source.indexOf('for (let r = i', partsBlockStart);
      if (forStart >= 0 && forStart <= partsBlockStart + 600) {
        const forBrace = source.indexOf('{', forStart);
        if (forBrace > 0 && !source.slice(forBrace, forBrace + 800).includes('isPartsTotalSectionStop')) {
          const inject =
            '\n                if (window.SDLGClaimParserHelpers && window.SDLGClaimParserHelpers.isPartsTotalSectionStop(lines[r])) break;\n' +
            '                if (/Dealer\\s+Distributor\\s+Labour|Labour\\s+Hrs\\s+Rate|TOTAL\\s+AMOUNT\\s+CLAIMED/i.test(lines[r] || "")) break;';
          source = source.slice(0, forBrace + 1) + inject + source.slice(forBrace + 1);
          changed = true;
          console.log('PARTS TOTAL section stop injected.');
        }
      }
    }

    let totalAssigns = 0;
    source = source.replace(
      /const n = parseSourceNumber\(x\);?\s*if \(n != null\) \{ (out|result)\.totalAmount = n/g,
      (m, which) => {
        totalAssigns += 1;
        return (
          'const n = (window.SDLGClaimParserHelpers && window.SDLGClaimParserHelpers.parseCellMoney) ? window.SDLGClaimParserHelpers.parseCellMoney(x) : parseSourceNumber(x); if (n != null) { ' +
          which +
          '.totalAmount = n'
        );
      }
    );
    if (totalAssigns) console.log(`TOTAL AMOUNT uses parseCellMoney (${totalAssigns}).`);
    console.log('Money harden v1 applied (best-effort).');
  } catch (err) {
    console.warn('Money harden skipped (build continues): ' + err.message);
  }
}

if (changed) fs.writeFileSync(htmlPath, source);

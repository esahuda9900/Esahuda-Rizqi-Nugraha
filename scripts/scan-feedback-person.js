const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const needles = [
  'Akhsana',
  'Feedback Person',
  'feedback person',
  'technical_personnel',
  'Technician',
  'feedbackPerson',
  'feedback_person',
  'Technical Personnel'
];
for (const n of needles) {
  let idx = 0;
  let count = 0;
  while ((idx = html.indexOf(n, idx)) !== -1 && count < 5) {
    const start = Math.max(0, idx - 120);
    const end = Math.min(html.length, idx + n.length + 180);
    console.log('\n===', n, '@', idx, '===');
    console.log(html.slice(start, end).replace(/\n/g, '\\n'));
    idx += n.length;
    count += 1;
  }
  if (count === 0) console.log('\n(no hits for', n + ')');
}

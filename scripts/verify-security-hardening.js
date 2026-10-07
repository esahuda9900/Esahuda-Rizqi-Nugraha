const fs = require('node:fs');

const file = 'supabase/migrations/20260922100000_harden_policy_runtime_snapshot_invoker.sql';
const source = fs.readFileSync(file, 'utf8');

const required = [
  /create\s+or\s+replace\s+function\s+public\.sdlg_policy_runtime_snapshot/i,
  /security\s+invoker/i,
  /revoke\s+execute\s+on\s+function\s+public\.sdlg_policy_runtime_snapshot\(\)\s+from\s+anon/i,
  /grant\s+execute\s+on\s+function\s+public\.sdlg_policy_runtime_snapshot\(\)\s+to\s+authenticated/i,
];

for (const pattern of required) {
  if (!pattern.test(source)) {
    throw new Error('SECURITY MIGRATION VERIFY FAILED: missing ' + pattern);
  }
}

// This migration must be privilege hardening only. It must not mutate business data.
if (/\b(insert|update|delete|truncate)\s+into?\b/i.test(source) ||
    /\b(insert|update|delete|truncate)\b/i.test(source.replace(/--.*$/gm, ''))) {
  throw new Error('SECURITY MIGRATION VERIFY FAILED: unexpected DML in hardening migration.');
}

console.log('SECURITY MIGRATION STATIC VERIFY PASS');
console.log('Migration:', file);

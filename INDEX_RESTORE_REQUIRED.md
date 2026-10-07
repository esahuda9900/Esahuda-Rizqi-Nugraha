# index.html integrity

**Live edge (2026-09-30):** production HTML is healthy (~3.1 MB) with SOURCE LOCK WO patches and policy **v1.4.1**.

If Git `index.html` is ever corrupted again (missing `</head>`):

1. **Automatic:** `npm run build` / Cloudflare build runs `build-production.js` self-heal (download from production URL, then apply-* chain).
2. **Manual:**

```bash
curl -fsSL -A 'Mozilla/5.0' \
  'https://sdlg-warranty-backup.esahuda9900.workers.dev/' \
  -o index.html
node scripts/apply-master-model-source-lock.js
git add index.html && git commit -m "fix: restore index.html from production" && git push
```

Do not upload multi-megabyte `index.html` through tools that truncate content.

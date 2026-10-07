# modules/core — Phase C (LIVE scaffold)

Pure helpers: **no DOM, no fetch, no Supabase**.

| File | API |
|------|-----|
| `date.js` | `SDLGCoreDate.normalizeDateInput`, `parseDateOnly` |
| `currency.js` | `SDLGNormalizeClaimCurrency`, `SDLGEffectiveClaimCurrency` (also `SDLGCoreCurrency`) |
| `constants.js` | `SDLGCoreConstants.WORKFLOW_STATUSES`, `workflowMoveWarning`, `statusColor` |
| `bridge.js` | loads the three above early |

## Contract with index.html

`index.html` already does:

```js
if (typeof window.SDLGNormalizeClaimCurrency === 'function') {
  return window.SDLGNormalizeClaimCurrency(...);
}
```

So currency is **externalized without editing the 3 MB file** when `currency.js` loads first.

## Rules

- core must not import UI / parser / data-access
- keep behavior identical to monolith copies until tests exist

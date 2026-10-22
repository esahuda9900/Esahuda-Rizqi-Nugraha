# SESSION_STATE — 2026-10-22

## Emergency architecture

- `index.html` (~5KB): login only → redirect `./app.html`
- `app.html` (~745KB): full React app after session exists

Heavy seed/maps stripped. Observer modules stubbed.

Test: Incognito open site root → login form must appear instantly.

# DESIGN.md — SDLG Warranty Claim

> Visual single source of truth. Read before any UI/CSS change.  
> Goal: professional operational tool, not generic AI SaaS.

## Aesthetic direction (locked)

**Industrial / professional operational tool.**

- Dense, information-first, calm, trustworthy
- Field-service / ERP / warranty-ops feel — not marketing SaaS
- Reference mood: modern internal ops dashboards (dense tables, clear status, minimal chrome)
- Avoid: Linear / Notion / “startup landing page” aesthetics

Tone keywords: **operational · precise · restrained · durable**

## Active visual layer (2026-10-01)

| Asset | Role |
|-------|------|
| `styles/sdlg-ops-clean-v1.css` | Base cascade — DESIGN.md tokens |
| `styles/sdlg-warranty-tracking-v1.css` | **Tracking System layer** — Owner/Stage/Next panel + list chips |
| `modules/ops-clean-ui.js` | Injects ops-clean stylesheet |
| `modules/warranty-tracking-ux.js` | Progressive tracking panel + list enhancement |
| Loader | `modules/navigation-state.js` (dynamic load pattern) |

Earlier layers (`modern-refresh`, `saas-shell`, etc.) remain for compatibility; ops-clean + tracking win.

## Warranty Tracking System (core IA)

The product is a **Warranty Tracking System**, not only a claim database.

Every claim surface (list + detail) should answer, in this order:

1. **Current Owner** — who is responsible right now
2. **Current Stage** — where the claim sits in the real process
3. **What Happened** — last meaningful event / route decision
4. **Why Blocked** — clear blocker or empty if none
5. **Next Action** — what the current operator should do
6. **Evidence** — supporting docs / timeline
7. **Handoff** — who receives it next

Decision-first progressive disclosure: **What is happening → Why → What should I do next**.

Claim Detail uses a sticky `.sdlg-tracking-panel` (injected by `warranty-tracking-ux.js`) plus the existing `.sdlg-route-summary` (Manus decision panel — keep and extend, do not replace).

### Real process mapping (UI labels)

**Full 12-step operational workflow lives in `BUSINESS_RULES.md` (source of truth).** Do not re-ask the product owner for it.

Visual stages should feel close to that flow:

1. Branch intake / Marketing WO  
2. TS eligibility + Approval Code (or reject + reason)  
3. Warranty WO + part replacement  
4. Replacement report → TS review (loop)  
5. Admin submit to SDLG  
6. SDLG decision + Settlement flag → agreement / invoice / payment / close  

Do **not** invent backend fields. Only surface or re-label data already present on the page.

## Banned patterns (AI slop — hard reject)

Do **not** introduce any of the following:

| Category | Banned |
|----------|--------|
| Effects | Glassmorphism, frosted panels, backdrop-blur as decoration |
| Color | Decorative gradients, gradient text, glow, neon accents |
| Shape | Oversized border-radius (> 8–10px on cards), pill everything, floating shells |
| Layout | Nested cards / card-in-card, hero sections inside authenticated app, fake metric grids that only fill space |
| Motion | Bounce, spring, scale-on-hover as default; transform theater |
| Type | Inter / Roboto / Open Sans / system-ui as **display** font |
| Palette | Default purple/blue-dark “AI SaaS” schemes |
| Copy | Vague SaaS filler (“Unlock insights”, “Power your workflow”), eyebrow labels without purpose |

If a change only looks “modern” because of the above, it is wrong for this product.

## Preferred hierarchy (separation)

Separate content in this order; stop as soon as it reads clearly:

1. **Whitespace**
2. **Subtle background lightness shift** (3–5%)
3. **Soft elevation** (minimal shadow, if any)
4. **Border** only if the above fail — never a flat gray line as first resort

Default cards: **borderless or very light border**, not heavy framed boxes.

## Tokens (locked — ops-clean-v1)

### Color

| Token | Value |
|-------|-------|
| `--sdlg-bg` | `#f5f7fa` |
| `--sdlg-surface` | `#ffffff` |
| `--sdlg-surface-muted` | `#f1f4f8` |
| `--sdlg-border` | `#e2e8f0` |
| `--sdlg-border-strong` | `#cbd5e1` |
| `--sdlg-text` | `#0f172a` |
| `--sdlg-muted` | `#64748b` |
| `--sdlg-primary` | `#1e4ed8` (restrained slate-blue) |
| `--sdlg-success` | `#059669` |
| `--sdlg-warning` | `#b45309` |
| `--sdlg-danger` | `#dc2626` |

Accent usage: ~10% of UI; primary action only. No rainbow.

### Radius

| Token | Value |
|-------|--------|
| Control / input | **6px** (`--sdlg-radius-sm`) |
| Card / panel | **8px** (`--sdlg-radius`) |
| Modal | **10px** max |
| Pill | only where a true pill is required (status badges) |

### Typography

- System stack for body; weight hierarchy over extra families
- Body / tables: 12.5–14px dense ops scale
- Page title: clamp 22–28px, weight 700, tight tracking

### Spacing

- Base rhythm: **4px**
- Density: **compact** — ops tool, not marketing site
- Card pad: 12–16px; metric cards tighter

### Motion

- Prefer none or subtle color/border transitions only
- **No** `translateY` / scale-on-hover theater
- Respect `prefers-reduced-motion`

### Shadow

- xs / sm only — no large floating elevation

## Layout principles by surface

### Login / signup

- Calm, secure, minimal chrome
- Signup CTA must remain discoverable (“Belum punya akun? Buat akun”)
- No marketing hero, no gradient background theater

### Claim list / dashboard / command center

- Dense tables, clear status chips, scannable columns
- Action priority visible (P0/P1 vs monitoring)
- Filters and export accessible without hunting
- List rows should surface stage / blocked / next chips when possible

### Claim detail

- Information hierarchy: **Claim identity → Tracking (Owner/Stage/Blocked/Next)** → one warranty route decision → workflow status track → technical/evidence/parts/history.
- Keep the Claim Detail calm: one **case sheet**, not a stack of competing cards.
- Tracking UX is the canonical operator summary; Warranty Assessment is fallback-only when Tracking UX is unavailable.
- The detail toolbar contains actions only; claim identity belongs in one command header.
- Avoid dark gradient hero strips, repeated decision summaries, card-within-card layouts, and six floating workflow boxes.
- Workflow should read as a thin process rail; technical sections should read as an operations record with quiet separators.
- Command header should identify Claim ID + unit + customer + branch + current stage/age before deeper evidence.
- Warranty route (SDLG / Marketing / Review) must be unmistakable
- Feedback Person = **name only** (no “Technician —” prefix)
- Sticky tracking panel on desktop for daily ops speed

### Export / tables

- Professional, printable density
- Consistent currency and column alignment
- Prefer clarity over decoration

### Mobile

- Touch targets adequate; primary actions reachable
- Avoid hover-only interactions for critical paths
- Tracking panel becomes static 2-column grid

## Status & warranty visual language

| Concept | Treatment |
|---------|-----------|
| SDLG in warranty | Clear positive / in-policy indicator |
| SDLG OOW | Neutral warning, not “error red” by default |
| Marketing in warranty | Distinct secondary route (not the same as SDLG) |
| Review required | Explicit attention state |
| Error / blocked | Reserved for real failures |
| Next action | Success-soft highlight so operators see it first |

Do not invent new badge styles that conflict with existing live markers.

## Accessibility floor

- Text contrast suitable for dense ops UI (aim WCAG AA; prefer stronger on status text)
- Focus rings visible — do not remove for aesthetics
- Do not rely on color alone for warranty route

## Definition of done (UI)

A UI change is done only when:

1. It matches this aesthetic direction
2. No banned pattern was introduced
3. Tokens (radius, density, hierarchy) stayed consistent with ops-clean / live production
4. Critical actions remain discoverable (login CTA, export, claim actions)
5. Mobile and desktop both remain usable for claim work
6. Tracking model (Owner → Stage → Blocked → Next) is clearer than before

## Anti-slop checklist (run before shipping UI)

- [ ] No glass / heavy gradient / glow
- [ ] Radius ≤ 8–10px on cards
- [ ] No nested card theater
- [ ] No Inter-as-display default
- [ ] Status hierarchy clearer than decoration
- [ ] Whitespace used before borders
- [ ] Looks like an **ops tool**, not a generic AI template
- [ ] Tracking panel answers Owner / Stage / Next without hunting

---

*Last aligned: 2026-10-01 (warranty-tracking-v1 + full workflow pointer). Prefer editing tokens here over one-off magic numbers in CSS.*

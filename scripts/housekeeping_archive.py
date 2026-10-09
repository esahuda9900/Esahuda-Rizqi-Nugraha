#!/usr/bin/env python3
"""Archive one-off workflows and organize root markdown into docs/.

Safe / idempotent. Run via workflow_dispatch or locally.
Does NOT delete essential deploy/security/backup workflows.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Keep these workflows active under .github/workflows/
KEEP_WORKFLOWS = {
    "static.yml",
    "bake-source-to-production.yml",
    "deploy-cloudflare.yml",
    "sdlg-supabase-backup.yml",
    "browser-smoke.yml",
    "browser-e2e-auth.yml",
    "production-smoke.yml",
    "frontend-ci.yml",
    "security-hardening.yml",
    "free-tier-budget.yml",
    "architecture-guard.yml",
    "sync-ax-warranty-work-orders.yml",
    # self
    "housekeeping-archive.yml",
}

# Root markdown that stays at repo root
KEEP_ROOT_MD = {
    "README.md",
    "RUNBOOK_EMERGENCY.md",
    "STABLE_BACKUP.md",
    "AGENTS.md",
    "CLAUDE.md",
}

# Where to put other root .md files
MD_ROUTING = {
    "ARCHITECTURE.md": "docs/architecture/ARCHITECTURE.md",
    "ARCHITECTURE_STABILITY.md": "docs/architecture/ARCHITECTURE_STABILITY.md",
    "DESIGN.md": "docs/architecture/DESIGN.md",
    "PROJECT_CONTEXT.md": "docs/architecture/PROJECT_CONTEXT.md",
    "PLUGINS.md": "docs/architecture/PLUGINS.md",
    "DEPLOYMENT.md": "docs/runbooks/DEPLOYMENT.md",
    "DEPLOY_SAFETY.md": "docs/runbooks/DEPLOY_SAFETY.md",
    "RUNBOOK.md": "docs/runbooks/RUNBOOK.md",
    "RESTORE_CHECKLIST.md": "docs/runbooks/RESTORE_CHECKLIST.md",
    "RESTORE_RUNBOOK.md": "docs/runbooks/RESTORE_RUNBOOK.md",
    "RESTORE_INDEX_NOTE.md": "docs/runbooks/RESTORE_INDEX_NOTE.md",
    "INDEX_RESTORE_REQUIRED.md": "docs/runbooks/INDEX_RESTORE_REQUIRED.md",
    "SETUP.md": "docs/runbooks/SETUP.md",
    "SECURITY.md": "docs/runbooks/SECURITY.md",
    "REGRESSION_TESTS.md": "docs/runbooks/REGRESSION_TESTS.md",
    "RELEASE_READINESS.md": "docs/runbooks/RELEASE_READINESS.md",
    "RELEASE_STABILITY.md": "docs/runbooks/RELEASE_STABILITY.md",
    "STABILIZATION.md": "docs/runbooks/STABILIZATION.md",
    "SLO.md": "docs/runbooks/SLO.md",
    "FREE_TIER.md": "docs/runbooks/FREE_TIER.md",
    "FREE_TIER_CI.md": "docs/runbooks/FREE_TIER_CI.md",
    "BUSINESS_RULES.md": "docs/business/BUSINESS_RULES.md",
    "DATA_DICTIONARY.md": "docs/business/DATA_DICTIONARY.md",
    "DATA_QUALITY.md": "docs/business/DATA_QUALITY.md",
    "WARRANTY_LOGIC.md": "docs/business/WARRANTY_LOGIC.md",
    "CUSTOMER_MASTER.md": "docs/business/CUSTOMER_MASTER.md",
    "MODEL_NAMING.md": "docs/business/MODEL_NAMING.md",
    "UNIT_LOOKUP.md": "docs/business/UNIT_LOOKUP.md",
    "ANALYTICS.md": "docs/business/ANALYTICS.md",
    "AUDIT_LOG_RETENTION.md": "docs/business/AUDIT_LOG_RETENTION.md",
    "INJECTOR_ROADMAP.md": "docs/archive/INJECTOR_ROADMAP.md",
    "CURRENT_STATUS.md": "docs/archive/CURRENT_STATUS.md",
}


def move(src: Path, dest: Path) -> str:
    if not src.exists():
        return f"skip missing {src.name}"
    if dest.exists():
        return f"skip exists {dest}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest))
    return f"moved {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)}"


def main() -> None:
    actions: list[str] = []

    # 1) Archive non-essential workflows
    wf_dir = ROOT / ".github" / "workflows"
    arch_dir = ROOT / ".github" / "workflows-archived"
    arch_dir.mkdir(parents=True, exist_ok=True)
    if wf_dir.exists():
        for yml in sorted(wf_dir.glob("*.yml")):
            if yml.name in KEEP_WORKFLOWS:
                continue
            dest = arch_dir / yml.name
            actions.append(move(yml, dest))

    readme_arch = arch_dir / "README.md"
    if not readme_arch.exists():
        readme_arch.write_text(
            "# Archived workflows\n\n"
            "One-off / historical GitHub Actions moved out of `.github/workflows/` "
            "so they no longer run on push.\n\n"
            "To re-enable: move a file back to `.github/workflows/`\n",
            encoding="utf-8",
        )
        actions.append("wrote workflows-archived/README.md")

    # 2) Organize root markdown
    for name, rel in MD_ROUTING.items():
        actions.append(move(ROOT / name, ROOT / rel))

    # 3) Docs index
    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    index = docs / "README.md"
    index.write_text(
        """# SDLG Documentation\n\n"""
        "Organized from root markdown (housekeeping 2026-10-09).\n\n"
        "## Structure\n\n"
        "- `architecture/` — system design, plugins, project context\n"
        "- `runbooks/` — deploy, restore, security, release\n"
        "- `business/` — rules, data dictionary, warranty logic\n"
        "- `archive/` — historical status / roadmaps\n\n"
        "## Critical (still at repo root)\n\n"
        "- `RUNBOOK_EMERGENCY.md` — 1-page emergency\n"
        "- `STABLE_BACKUP.md` — rollback branches\n"
        "- `README.md` — project entrypoint\n"
        ,
        encoding="utf-8",
    )
    actions.append("wrote docs/README.md")

    # 4) Root README if missing or tiny
    readme = ROOT / "README.md"
    if not readme.exists() or readme.stat().st_size < 200:
        readme.write_text(
            """# SDLG Warranty Claim System\n\n"""
            "Production app: [GitHub Pages](https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/)\n\n"
            "## Quick links\n\n"
            "- Emergency: [`RUNBOOK_EMERGENCY.md`](./RUNBOOK_EMERGENCY.md)\n"
            "- Stable backup: [`STABLE_BACKUP.md`](./STABLE_BACKUP.md)\n"
            "- Docs: [`docs/README.md`](./docs/README.md)\n\n"
            "## Stack\n\n"
            "Vanilla JS + React (CDN) · Supabase · GitHub Pages · Cloudflare\n\n"
            "## Deploy\n\n"
            "Push to `main` → workflow **Deploy static content to Pages** "
            "(`scripts/pages_prepare_index.py` safety net).\n\n"
            "## Backup branches\n\n"
            "- `backup/stable-2026-10-09-portal-ok`\n"
            "- `backup/stable-2026-10-09-baked-source`\n"
            ,
            encoding="utf-8",
        )
        actions.append("wrote README.md")

    print("housekeeping_archive.py done")
    for a in actions:
        print(" -", a)


if __name__ == "__main__":
    main()

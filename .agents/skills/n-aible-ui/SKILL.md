---
name: n-aible-ui
description: "Trigger: UI component, page, frontend, reskin, design system. Build accessible n-aible UI with project tokens and shadcn primitives."
license: Apache-2.0
metadata:
  author: n-aible
  version: "1.0"
---

## Activation Contract

Use for any frontend UI creation, reskin, or review in this repository. Preserve existing product behavior unless the task explicitly changes it.

## Hard Rules

- Read `frontend/app/globals.css`, `frontend/tailwind.config.ts`, and `frontend/components.json` before styling.
- Use semantic utilities (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`, `font-sans`, `font-heading`) and mapped spacing, radius, shadow, and motion tokens. Never introduce page-local palette or font values when a semantic token fits.
- Treat `frontend/components/ui/` as the primitive layer. Do not edit generated primitives for one feature; compose or extend them with variants.
- Keep user-facing copy in English unless the existing surface uses another language.

## Decision Gates

1. Search `frontend/components/ui/` for a shadcn primitive before creating an interactive element.
2. If it exists, compose it. If almost suitable, add a reusable variant with `cn`; do not duplicate markup.
3. If absent, confirm shadcn has no suitable primitive, then add a product component under `frontend/components/` only when the pattern is reusable.
4. Add a new global token only for a repeated semantic role, in both themes where applicable, then map it through Tailwind.

## Execution Steps

1. Identify the user, task, responsive states, and existing nearby patterns.
2. Reuse shadcn primitives and semantic tokens; keep domain logic outside presentation components.
3. Verify keyboard operation, visible focus, labels/names, contrast, loading/error/empty/disabled states, mobile layout, and reduced motion.
4. Run focused lint/type/build checks and inspect the rendered UI at mobile and desktop widths. Report blockers rather than claiming unrun checks passed.

## Output Contract

Report reused primitives, new shared patterns or tokens, accessibility/responsive checks, and exact validation commands/results. Flag any intentional exception to this contract.

## References

- `frontend/app/globals.css` — canonical CSS variables and global behavior.
- `frontend/tailwind.config.ts` — semantic utility mappings.
- `frontend/components.json` — shadcn configuration and aliases.
- `frontend/components/ui/` — installed primitive inventory.
- `frontend/app/layout.tsx` — global font and providers.

---
name: n-aible-ui
description: "Trigger: UI component, page, frontend, reskin, design system. Build accessible n-aible UI with project tokens and shadcn primitives."
license: Apache-2.0
metadata:
  author: n-aible
  version: "1.1"
---

## Activation Contract

Use for any frontend UI creation, reskin, or review in this repository. Preserve existing product behavior unless the task explicitly changes it.

## Hard Rules

- Read `references/current-ui-contract.md` and its canonical source files before styling.
- Use semantic utilities and mapped spacing, radius, shadow, typography, and motion tokens. Dark mode is neutral deep charcoal with blue `primary`; light mode is supported and persisted. Never copy token HSL values into components or create dark-only styling.
- Clash Grotesk is globally owned by `frontend/app/layout.tsx` and the `font-sans`/`font-heading` tokens. Do not add page-level font imports or font-family values.
- Search `frontend/components/ui/` first. Compose shadcn primitives; add a reusable variant or product component only when composition is insufficient. Never edit a generated primitive for one feature.
- Preserve role and domain ownership. Share presentation shells, not student/professor actions or metadata. Never fabricate scores, ranks, counts, dates, or workflow state.
- Keep user-facing copy in English unless the existing surface uses another language.

## Decision Gates

| Need | Action |
| --- | --- |
| Interactive UI | Reuse a shadcn primitive; extend with `cn`/variants only when reusable. |
| Repeated visual role | Add a semantic token in both themes, map it through Tailwind, then consume the utility. |
| Simulation card | Reuse `SimulationCardShell`: image above, content on a charcoal/card surface below; keep role-specific content outside the shell. |
| Preview details | Reuse the shared `Sheet` anatomy: independently scrolling body plus a docked, role-appropriate action footer. Student previews include progress; professor previews use operational controls and never student progress. |
| Modal layering | Keep global feedback below modal/sheet surfaces; verify close and docked actions remain reachable. |

## Execution Steps

1. Identify the user, task, responsive states, and existing nearby patterns.
2. Reuse the current shell, cards, sheets, shadcn primitives, and semantic tokens before creating anything.
3. Verify keyboard operation, visible focus, labels/names, contrast, loading/error/empty/disabled states, mobile layout, and reduced motion.
4. Inspect the rendered UI in both themes at mobile and desktop widths. Run focused checks and a production build. Do not run `next build` against the same `.next` directory while `next dev` is serving; stop/restart dev around the build. Report blockers rather than claiming unrun checks passed.

## Output Contract

Report reused primitives, new shared patterns or tokens, accessibility/responsive checks, and exact validation commands/results. Flag any intentional exception to this contract.

## References

- `frontend/app/globals.css` — canonical CSS variables and global behavior.
- `frontend/tailwind.config.ts` — semantic utility mappings.
- `frontend/components.json` — shadcn configuration and aliases.
- `frontend/components/ui/` — installed primitive inventory.
- `frontend/app/layout.tsx` — global font and providers.
- `references/current-ui-contract.md` — current theme, component, and interaction conventions.

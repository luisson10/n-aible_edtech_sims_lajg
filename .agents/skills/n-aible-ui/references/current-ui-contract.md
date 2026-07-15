# Current UI contract

Use this map to find the implementation source of truth. Do not duplicate the literal color values here or in feature components; they can evolve in `globals.css`.

## Theme and typography

- `frontend/app/globals.css` owns semantic CSS variables for both `:root` and `.dark`. The dark palette uses neutral deep-charcoal roles (`background`, `card`, `popover`, `surface`, `surface-subtle`, and `surface-muted`), while `primary` remains the product blue. Consume them through utilities such as `bg-background`, `bg-card`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, and `ring-ring`.
- `frontend/tailwind.config.ts` maps the semantic palette plus product spacing, radius, elevation, motion, and typography. Prefer these mappings over arbitrary values.
- `frontend/app/layout.tsx` loads Clash Grotesk with `next/font/local`, applies its variable to `<html>`, defaults to dark, and enables class-based theme persistence through `next-themes`.
- `frontend/components/theme-provider.tsx` owns the provider wrapper. `frontend/components/RoleBasedSidebar.tsx` owns the accessible light/dark toggle. Do not create page-local theme state.

## Primitive and composition boundaries

- `frontend/components.json` and `frontend/components/ui/` define the shadcn setup and installed primitive inventory. Search this layer before writing interactive markup.
- `frontend/components/simulation-card-shell.tsx` is the shared visual frame for simulation cards: 16:9 image/fallback on top, semantic card surface below, status overlays, and consistent hover/motion. The consuming link or button owns visible focus and accessible naming. Student, cohort, and professor components own their own truthful metadata and actions.
- Current consumers include `frontend/components/student-dashboard/StudentSimulationCard.tsx`, `frontend/components/student-cohorts/CohortSimulationCard.tsx`, and `frontend/components/professor-dashboard.tsx`. Reuse the shell rather than rebuilding image-overlay cards.

## Preview and layering conventions

- Preview surfaces share only the shadcn `Sheet` anatomy: independently scrollable details plus a docked, non-scrolling action footer.
- `frontend/components/student-dashboard/StudentSimulationPreview.tsx` is the student reference. It clamps descriptions to five lines with conditional Show more/less and docks progress with the Start/Continue/Review action.
- `frontend/components/professor-dashboard.tsx` is the professor reference. It docks operational actions such as Configure, Test simulation, and lifecycle controls; it must not show student progress or student actions.
- `frontend/components/DraggableFeedback.tsx` intentionally sits below Radix modal/sheet surfaces. Verify overlay, close control, scroll body, and docked actions together; do not solve collisions with isolated page-level z-index escalation.

## Acceptance checks

- Use real API/domain data or an explicit unavailable/empty state; never infer or invent metrics.
- Check keyboard and screen-reader names, visible focus, contrast, reduced motion, image fallback/alt behavior, content overflow, safe-area padding, and loading/error/empty/disabled states.
- Visually inspect light and dark themes at mobile and desktop widths. Keep `next dev` and `next build` from writing the same `.next` directory concurrently; restart the dev server after a production build before browser QA.

# Campus Atlas map workspace implementation plan

**Goal:** Ship the six approved workspace improvements while preserving existing rentals, chat, routes and student planning.
**Architecture:** Keep the Cesium viewer and side panels mounted. Store only desktop layout preferences locally; keep layout separate from agent/server state. Reuse current facility controls and route panels under unified disclosures. Project markers directly into DOM with deterministic collision priority.
**Tech Stack:** React 19, TypeScript, CesiumJS, CSS, existing node:test runner.

## Global constraints
- Preserve spatial B design, bilingual UI, mobile tabs, route data/providers and attribution.
- Collapse must preserve drafts, requests, card/photo/scroll state and camera; never destroy the viewer.
- Review and verify locally, push GitHub first, deploy Cloudflare second. Exclude credentials/runtime/builds.

## Tasks
- [x] Add `app/lib/workspace-layout.ts`, `app/components/use-workspace-layout.ts` and focused transition/storage tests. Verify independent panel state, focus restore, malformed storage and reset.
- [x] Update `app/components/design-lab/design-lab.tsx`, `app/components/rental-chat.tsx`, `app/app/design-lab/design-lab.css`: desktop controls, inert collapsed panels, bounded scrolling, completion badge and bidirectional hover/select.
- [x] Add `app/components/design-lab/map-layers.tsx` and `journey-disclosure.tsx`; integrate in `concept-city-map.tsx` without changing viewer lifecycle. Keep layer configuration and route details mounted; clearing and folding remain separate actions.
- [x] Add `app/lib/map-marker-density.ts` with collision/priority tests; use it in campus and listing marker projection. Preserve selected/focused destinations. Adapt route fit to visible panels and summary bounds.
- [x] Run typecheck, targeted lint, workspace and student/agent tests. Exercise four desktop states, focus restore, list/map interactions, route folding/layers, draft preservation and mobile/bilingual/reduced motion in browser.
- [x] Review changes with Before/After/Why findings and fix actionable regressions. Record verification and limits in `research/2026-10-14-workspace-acceptance.md`.
- [ ] Announce Git scope, commit/push to `origin/main`, record full SHA; build and deploy Worker/Pages; verify public health and affected UI.

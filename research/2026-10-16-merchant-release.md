# Merchant and moderation first release — 2026-10-16

## Delivered scope

- `/merchant`: authenticated application, operator approval, property + multiple room types, server drafts and browser recovery, coordinates / entrance confirmation and OSM preview, facilities, student eligibility, rent period, deposit, fees, bills, lease/date/quantity, terms, photos and floor plans, copy, submit and withdraw.
- `/admin`: operator-only merchant and property review, rejection reasons, takedown, reports and audit history. Admin requires the explicitly authorized email, a verified auth user and a Google account relation. Ordinary email registration cannot obtain this role.
- `/inquiries`: account-owned enquiries and video / in-person viewing requests, timezone-aware appointments, merchant confirmation / decline and replies. Rescheduling is discussed in messages and submitted as a new request.
- Publication copies an approved snapshot. Edits and rejected revisions do not overwrite the existing live version. All public readers use the same published catalogue; private application evidence and contact data are excluded.
- Published room IDs work with list/detail/map/AI, nearby places, real pedestrian routing, favorites, notes, comparison and student planning. New routes are calculated on demand and cached; unknown walking durations are excluded from hard commute filters, not guessed.
- Storage decision: existing SQLite / Cloudflare D1 only, no R2 activation. JPEG/PNG/WebP upload, browser compression, 250 KB/photo, 60/merchant, 200 MiB global raw-image cap with base64 headroom. Public access requires a published reference; unused deletion is owner-only. Source uploads are limited to 15 MB.

## Verification and review

- TypeScript passed; 34 selected tests passed, including four real D1/Miniflare tests. Existing authentication, AI tools and student planner regressions included.
- Actual local browser: separate host / operator / student fixture accounts. Application -> approval -> property -> compressed upload/reorder -> preview -> review -> publication -> map -> enquiries/viewing -> merchant confirmation -> student follow-up. Local fixtures were not copied to production.
- Chinese and English; desktop, 390 px and 320 px. Confirmed no horizontal overflow in tested merchant forms, review cards and conversations. Verified server draft, picture reuse, date persistence, private account notes and post-login inquiry destination.
- Live provider acceptance locally: selected published merchant listing -> English AI rent/deposit/availability and 14 nearby convenience stores; Chinese AI walking route -> real Cesium map and OSRM 10 min / 700 m route. This uses existing provider credentials, not a mock model.
- Real local HTTP sessions: ordinary student denied admin and upload; guest mutations rejected; cross-origin mutation rejected; oversized upload rejected; private images denied to guests and other accounts, allowed to owner/operator; in-use photos cannot be deleted.
- Review corrections: stale-edit version checks; old published snapshot retained; coordinate-sensitive route cache; bounded media ownership queries; route summaries project JSON fields instead of loading geometry into the catalogue; student replies preserve a confirmed appointment; merchant comparison/planner includes the dynamic catalogue; duplicate detail section and misleading demo copy removed.
- Cloudflare build guard: no secret leakage, no SQLite runtime imports, D1 binding present. Third-party vinext dynamic-import build notices are unchanged. Existing plain-image ESLint warnings remain; new hook-dependency warnings were corrected.

## First-version limits

No payment, contract signing, email notifications, shared merchant teams or bulk import. Address position is entered as coordinates with a map preview / external address lookup, not automatic geocoding. Nearby-place snapshots remain limited to the existing campus coverage. Platform review is not an on-site inspection or safety certification. Mobile evidence is browser viewport acceptance, not new physical-iPhone soft-keyboard acceptance. Audit records are written after successful mutations; they are not transactional with the mutation in this version. Dashboard feeds are capped (200 admin rows, 100 conversations), suitable for the current demo scale.

## Release order

Review / local acceptance -> GitHub main -> additive D1 migration 0004 -> Worker -> Pages -> public UI and asset verification. Secrets, local databases, logs and QA fixtures are excluded from Git.

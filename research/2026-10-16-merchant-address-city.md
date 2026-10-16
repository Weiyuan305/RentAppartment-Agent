# Merchant address entry and remembered city

## Delivered behavior

- Approved merchants inherit their first onboarding city, can switch the default in the workspace, and save this preference against their account in D1. New properties inherit it; existing drafts and published homes retain their own city.
- The location step starts with address and optional postcode. Hong Kong does not show a postcode field. Neighbourhood remains editable.
- Explicit address lookup returns at most five candidates, distinguishing building/street/area matches. Selecting a candidate never marks it as a verified entrance or invents a complete address. Publication still requires a full address and explicit entrance confirmation.
- Leaflet loads only for the location step. Merchants can click, drag a vector pin, or use the keyboard to move the map and choose its centre. Exact coordinates remain available in a collapsed optional section. Location edits clear entrance confirmation.
- Published postcode joins the public address and is therefore available through the existing catalogue, property details and AI tools. Existing moderation/published-snapshot behavior remains intact.

## Provider and operating limits

This is a small demonstration use of the public Nominatim service, not a geocoding SLA or an unlimited free production service. There is no autocomplete, bulk lookup, or prefetch. Only approved merchants can call the endpoint; the same-origin and authentication checks apply.

The server identifies Campus Atlas, caches successful results for seven days (empty results for five minutes), and removes expired geocoding entries. A D1 lease permits only one upstream call at a time across Worker instances, followed by a 1.1-second gap. Each account has a 20-per-minute quota. The upstream timeout is ten seconds. Failures and empty results invite retry or direct map selection rather than silently assigning city-centre coordinates.

`ATLAS_GEOCODING_URL` can switch the server to another HTTPS Nominatim-compatible endpoint without rebuilding the client. Map tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, preserve normal browser caching/referer behavior, and display attribution. The privacy notice explains address transmission and excludes contact/review documents from it.

Official references checked:
- https://operations.osmfoundation.org/policies/nominatim/
- https://operations.osmfoundation.org/policies/tiles/
- https://nominatim.org/release-docs/latest/api/Search/
- https://leafletjs.com/reference.html

## Verification and review

- TypeScript and focused ESLint passed.
- 13 tests passed across merchant, address, authentication and real local D1 runtime suites. Covered account/city isolation, default fallback/persistence, unchanged existing property city, legacy draft schema, postcode in public catalogue, rejected bad countries/coordinates, global upstream concurrency, caching, empty/error results and previous merchant moderation/AI flow.
- Actual local browser with an isolated approved merchant: switch London to Manchester, reload, create a property, query Oxford Road through the real Nominatim service, choose a street result, click and drag the pin, confirm, save, reload and reopen. Existing London property retained its city. Switching the draft to Hong Kong cleared its old address/location and hid postcode, without changing the workspace default.
- Chinese and English desktop and 320/390px browser viewports inspected, including long candidate wrapping, map tiles/attribution, controls and city disclosure. No document horizontal overflow or new browser warning/error was observed. These viewport checks are not physical iPhone/Android keyboard acceptance.
- Main-agent review covered authentication, same-origin enforcement, D1 migration compatibility, upstream data rendering, request cancellation, account-default versus draft separation, map cleanup and legacy records. Fixed stale recovery acknowledgement and map-control locale labels during review.

## Release

Apply additive migration `0005_merchant_preferences.sql` before deploying the new Worker. Publish the Worker and then Pages using the repository's existing scripts. Public signed-in/default-city verification requires an approved merchant; local QA accounts and drafts must not be copied into production.

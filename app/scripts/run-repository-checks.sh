#!/usr/bin/env bash
# Repository checks from app/README.md (验证). The Node build shares dist/
# with the Cloudflare build, so a Cloudflare deploy must run build:cloudflare
# after this script.
set -euo pipefail

cd "$(dirname "$0")/.."

npm run typecheck
npm run test:sample
npm run test:agent
npm run test:d1
npm run test:routes
npm run test:amenities
npm run test:amenity-routes
npm run build

# CISOAlert

A **privacy-first iOS app** for CISOs. Declare your tech stack once (clouds, IDPs,
endpoint, software/hardware vendors, security vendors) and get a **daily threat
briefing** — and push alerts — collated from authoritative public threat intel
(CISA KEV, NVD) plus curated security news, filtered to *your* stack and written up
by Claude.

## Privacy principles (non-negotiable)

1. **No PII, ever.** No accounts, no name/email/company. Identity is a random
   anonymous UUID stored in the Keychain. Only opaque `tech_key`s and the APNs push
   token leave the device.
2. **The app never calls upstream intel APIs.** NVD / Anthropic / APNs keys live only
   in Cloudflare Worker secrets. The Worker is the key-protection and rate-limit
   boundary. The iOS app talks only to the Worker.
3. **Secrets never in git.** Keys/tokens (`.p8`, `.env`, `.dev.vars`) are gitignored
   and installed via `wrangler secret put`.
4. **HTTPS only, ATS enforced.** No `http://` endpoints, no ATS exceptions.
5. **No third-party analytics / ads / tracking SDKs.**
6. **Data deletion is a feature.** Settings → "Delete my data" purges the device row,
   stack, and push log on the server and clears local state.

## Architecture

Three components with clean boundaries:

- **`ios/`** — SwiftUI, iOS 17+, project generated from `project.yml` via
  [xcodegen](https://github.com/yonsm/XcodeGen). Anonymous Keychain identity; four
  tabs (Vulns · Threats · News · Settings), each with a 14-day history.
- **`worker/`** — Cloudflare Worker (TypeScript) + Cron Trigger + D1. Ingests CISA KEV
  + NVD 2.0 + curated RSS feeds, maps CVEs/articles to `tech_key`s, classifies and
  enriches with Claude, serves the per-category briefing API, and signs APNs JWTs
  directly.
- **Threat intel** — v1: CISA KEV (no key) + NVD 2.0 (optional key) + RSS. Later:
  vendor advisories, Patch Tuesday, GitHub Security Advisories.

Data flow: `Cron → ingest → D1 → GET /v1/briefing → app`.
Push: `Worker signs JWT → api.push.apple.com → device`.

## Build

```bash
# iOS — generate the Xcode project (after editing project.yml)
cd ios && xcodegen generate

# iOS — build for the simulator (no signing)
cd ios && xcodebuild build -project CISOAlert.xcodeproj -scheme CISOAlert \
  -destination "platform=iOS Simulator,name=iPhone 17" \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO

# Worker — local dev
cd worker && npx wrangler dev

# Worker — run tests
cd worker && npx vitest run

# Worker — deploy
cd worker && npx wrangler deploy

# Worker — apply D1 schema
cd worker && npx wrangler d1 execute cisoalert --file=./schema.sql
```

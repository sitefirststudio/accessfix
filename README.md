# Access Fix website + free checker

Static site (EN `/`, DE `/de/`) plus a Cloudflare Worker that runs the free accessibility check
(headless Chrome via Browser Rendering + axe-core) and stores reports in KV.

- `site/i18n.mjs`  all page copy (English and German)
- `site/build.mjs` builds `public/` (run `npm run build`)
- `public/assets/` CSS, simulator, report page, plain-language rules
- `src/` Worker: `/api/scan`, `/api/report/:id`, `/r/:id`, `/api/leads?key=`

Deploy: Cloudflare Workers Builds connected to this repo, build command `npm run build`,
deploy command `npx wrangler deploy`. Placeholders in the Impressum and privacy pages must be
filled with Site First Studio's legal details before launch.

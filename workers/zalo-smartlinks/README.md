# Zalo smart links Worker

Opens the Zalo app for `go.vangquan.com/quan-zalo` and `/vang-zalo` depending on the device,
and falls back to the web chat when the app does not open.

| Device | Target |
| --- | --- |
| Android | `android` deep link |
| iPhone, iPod, iPad | `ios` deep link (iPads are detected by touch support) |
| Windows, Mac, Linux | `desktop` deep link |
| Anything else | `fallback` web chat |

The fallback page opens after 2.5 seconds, unless the app took focus first.
Edit the `LINKS` table in `src/index.js` to add or change a link.

## Test and deploy

```bash
node --test workers/zalo-smartlinks/test/worker.test.mjs
cd workers/zalo-smartlinks && npx wrangler deploy --dry-run   # check what would change
npx wrangler deploy                                           # production: replaces the running Worker code
```

## Narrow the route (recommended)

The Worker currently sits in front of every `go.vangquan.com` path and proxies the rest to Sink.
In the Cloudflare dashboard, under Workers, `zalo-smartlinks-worker`, Settings, Domains & Routes,
replace the catch-all with two routes: `go.vangquan.com/quan-zalo` and `go.vangquan.com/vang-zalo`.
If the entry is a Custom Domain, remove it first, then add the routes. Sink then answers everything else directly.

## Click counts

Each visit is written to the `zalo_clicks` Analytics Engine dataset (slug, platform, country).

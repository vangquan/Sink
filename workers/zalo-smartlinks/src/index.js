// Device-aware smart links that open the Zalo app, with a web fallback.
// Any other path is passed through to Sink, so this Worker can stay in front of go.vangquan.com.

const UPSTREAM = 'https://sink-wks.pages.dev'
const APP_OPEN_TIMEOUT_MS = 2500

const LINKS = {
  'quan-zalo': {
    ios: 'zalo://qr/p/13fp105mywpy6',
    android: 'zalo://zaloapp.com/qr/p/13fp105mywpy6',
    desktop: 'zalo://conversation?phone=0834551914',
    fallback: 'https://chat.zalo.me/?phone=0834551914',
  },
  'vang-zalo': {
    ios: 'zalo://qr/p/c29by5yhw2b3',
    android: 'zalo://zaloapp.com/qr/p/c29by5yhw2b3',
    desktop: 'zalo://conversation?phone=0934551914',
    fallback: 'https://chat.zalo.me/?phone=0934551914',
  },
}

// 'mac' is ambiguous: iPadOS Safari sends a Macintosh user agent, so the page
// checks for a touch screen and switches to the iOS link when it finds one.
export function detectPlatform(userAgent) {
  const ua = userAgent.toLowerCase()
  if (ua.includes('android'))
    return 'android'
  if (/iphone|ipod|ipad/.test(ua))
    return 'ios'
  if (ua.includes('macintosh'))
    return 'mac'
  if (/windows|linux|cros/.test(ua))
    return 'desktop'
  return 'unknown'
}

export function pickTarget(cfg, platform) {
  if (platform === 'android')
    return cfg.android
  if (platform === 'ios')
    return cfg.ios
  if (platform === 'mac' || platform === 'desktop')
    return cfg.desktop
  return cfg.fallback
}

// JSON for an inline <script>: keep "<" from ever closing the tag.
function toInlineJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)
}

export function renderPage(cfg, platform) {
  const target = pickTarget(cfg, platform)
  const state = {
    target,
    iosTarget: cfg.ios,
    fallback: cfg.fallback,
    isMac: platform === 'mac',
    openApp: target !== cfg.fallback,
    timeout: APP_OPEN_TIMEOUT_MS,
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Opening Zalo…</title>
  <style>
    body { font: 16px/1.5 system-ui, -apple-system, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; text-align: center; color: #1d1d1f; background: #f5f5f7; }
    a.button { display: block; margin: .75rem auto; padding: .75rem 1.5rem; border-radius: 999px; background: #0071e3; color: #fff; text-decoration: none; }
    a.secondary { background: transparent; color: #0071e3; }
    @media (prefers-color-scheme: dark) { body { color: #f5f5f7; background: #000; } }
  </style>
</head>
<body>
  <main>
    <p>Opening Zalo…</p>
    <a class="button" id="open" href="${escapeHtml(target)}">Open Zalo</a>
    <a class="button secondary" href="${escapeHtml(cfg.fallback)}">Continue on the web</a>
  </main>
  <script>
    (function () {
      var s = ${toInlineJson(state)}
      var target = s.target
      // iPadOS reports a Mac user agent; a touch screen means it is an iPad.
      if (s.isMac && navigator.maxTouchPoints > 1)
        target = s.iosTarget
      document.getElementById('open').href = target
      if (!s.openApp && !s.isMac) {
        location.replace(s.fallback)
        return
      }
      var timer = setTimeout(function () { location.replace(s.fallback) }, s.timeout)
      // If the app takes focus the page is hidden or blurred; do not open the web version too.
      function cancel() { clearTimeout(timer) }
      document.addEventListener('visibilitychange', function () { if (document.hidden) cancel() })
      window.addEventListener('pagehide', cancel)
      window.addEventListener('blur', cancel)
      location.href = target
    })()
  </script>
  <noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(cfg.fallback)}"></noscript>
</body>
</html>`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const slug = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
    const cfg = Object.hasOwn(LINKS, slug) ? LINKS[slug] : undefined

    if (!cfg || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return fetch(new Request(UPSTREAM + url.pathname + url.search, request))
    }

    const platform = detectPlatform(request.headers.get('user-agent') || '')
    try {
      env.CLICKS?.writeDataPoint({
        indexes: [slug],
        blobs: [slug, platform, request.cf?.country ?? ''],
      })
    }
    catch (error) {
      console.error({ event: 'click.write.failed', message: String(error) })
    }

    return new Response(request.method === 'HEAD' ? null : renderPage(cfg, platform), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex',
      },
    })
  },
}

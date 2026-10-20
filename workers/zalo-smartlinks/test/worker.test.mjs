import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker, { detectPlatform, pickTarget, renderPage } from '../src/index.js'

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36',
  bot: 'curl/8.0',
}

const cfg = { ios: 'zalo://ios', android: 'zalo://android', desktop: 'zalo://desktop', fallback: 'https://chat.zalo.me/?phone=1' }

test('detects platforms', () => {
  assert.equal(detectPlatform(UA.android), 'android')
  assert.equal(detectPlatform(UA.iphone), 'ios')
  assert.equal(detectPlatform(UA.ipad), 'mac')
  assert.equal(detectPlatform(UA.windows), 'desktop')
  assert.equal(detectPlatform(UA.bot), 'unknown')
})

test('picks the target per platform', () => {
  assert.equal(pickTarget(cfg, 'android'), cfg.android)
  assert.equal(pickTarget(cfg, 'ios'), cfg.ios)
  assert.equal(pickTarget(cfg, 'mac'), cfg.desktop)
  assert.equal(pickTarget(cfg, 'unknown'), cfg.fallback)
})

test('page carries the target, fallback and the focus cancel', () => {
  const html = renderPage(cfg, 'desktop')
  assert.match(html, /zalo:\/\/desktop/)
  assert.match(html, /chat\.zalo\.me/)
  assert.match(html, /visibilitychange/)
})

test('serves a no-store page and records the click', async () => {
  const points = []
  const res = await worker.fetch(
    new Request('https://go.vangquan.com/Quan-Zalo/', { headers: { 'user-agent': UA.android } }),
    { CLICKS: { writeDataPoint: p => points.push(p) } },
  )
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.match(await res.text(), /zalo:\/\/zaloapp\.com\/qr\/p\/13fp105mywpy6/)
  assert.deepEqual(points[0].blobs.slice(0, 2), ['quan-zalo', 'android'])
})

test('passes other paths through to Sink', async () => {
  const original = globalThis.fetch
  let seen
  globalThis.fetch = async (req) => {
    seen = req.url
    return new Response('ok')
  }
  try {
    await worker.fetch(new Request('https://go.vangquan.com/abc?x=1'), {})
  }
  finally {
    globalThis.fetch = original
  }
  assert.equal(seen, 'https://sink-wks.pages.dev/abc?x=1')
})

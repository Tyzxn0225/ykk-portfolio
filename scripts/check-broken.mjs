/**
 * 列出页面上所有加载失败的图片，并逐个复验 URL。
 *
 * 为什么要复验：diagnose.mjs 报 "broken" 的依据是
 * `img.complete && img.naturalWidth === 0`，这在懒加载图片上可能是
 * 「尚未开始加载」而非「真的 404」。所以这里额外对每个失败 URL 直接发请求，
 * 区分「真的缺失」和「只是当时还没加载」。
 *
 *   node scripts/check-broken.mjs --url https://example.com/
 */
import { spawn } from 'node:child_process'
import { rm, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const URL_ = arg('url', 'http://127.0.0.1:5274/')
const PORT = Number(arg('port', 9420))
const W = Number(arg('width', 1920))
const H = Number(arg('height', 1080))

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'broken-'))
  const child = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`,
     '--hide-scrollbars', '--disable-gpu', 'about:blank'],
    { stdio: 'ignore' },
  )
  let ws
  let id = 0
  const pending = new Map()
  try {
    for (let i = 0; i < 60; i++) {
      try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break } catch { /* retry */ }
      await sleep(250)
    }
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id)
        pending.delete(m.id)
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
      }
    })
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const mid = ++id
        pending.set(mid, { resolve, reject })
        ws.send(JSON.stringify({ id: mid, method, params }))
      })

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: URL_ })
    await sleep(3000)

    // 先把整页滚一遍，确保懒加载的图都开始加载
    await send('Runtime.evaluate', {
      expression: `(async()=>{const s=Math.round(innerHeight*0.8);const e=document.documentElement.scrollHeight;for(let y=0;y<e;y+=s){scrollTo(0,y);await new Promise(r=>setTimeout(r,140))}scrollTo(0,0);await new Promise(r=>setTimeout(r,600))})()`,
      awaitPromise: true,
    })
    await sleep(1500)

    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const bad = [];
        document.querySelectorAll('img').forEach((img) => {
          if (img.complete && img.naturalWidth === 0) {
            bad.push({ src: img.currentSrc || img.src, displayed: img.getBoundingClientRect().width > 0 });
          }
        });
        return bad;
      })()`,
      returnByValue: true,
    })

    const bad = r.result.value
    console.log(`=== 滚动并等待后，仍失败的图片: ${bad.length} 个 ===`)
    for (const b of bad) {
      console.log(`  ${b.src}`)
      console.log(`    display 宽度 > 0: ${b.displayed}`)
    }

    // 逐个直接请求复验
    if (bad.length) {
      console.log('\n=== 逐个直接请求复验 ===')
      for (const b of bad) {
        try {
          const res = await fetch(b.src, { method: 'HEAD' })
          console.log(`  HTTP ${res.status}  ${res.headers.get('content-type') || ''}  ${b.src.split('/').pop()}`)
        } catch (e) {
          console.log(`  请求失败  ${b.src.split('/').pop()}  ${e.message}`)
        }
      }
    }
  } finally {
    try { ws?.close() } catch { /* noop */ }
    child.kill()
    await sleep(300)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
